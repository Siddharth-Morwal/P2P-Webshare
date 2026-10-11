import { useState, useRef, useCallback, useEffect } from 'react';
import { hashChunk, hashFile } from '../utils/hashing.js';
import { getChunkCount, readChunk, assembleAndDownload } from '../utils/chunking.js';
import { encodeMetadata, encodeComplete, encodeError, encodeChunk, decodeMessage } from '../utils/protocol.js';

export function useFileTransfer(webrtc) {
  const { dataChannelReady, sendData, onDataRef } = webrtc;

  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);

  const receivedChunksRef = useRef([]);
  const receivedCountRef = useRef(0);   // Bug 6 fix: O(1) counter replaces O(n) filter(Boolean)
  const speedTrackerRef = useRef([]);
  const metadataRef = useRef(null);     // Bug 3 fix: closure-safe metadata access

  const updateSpeed = (bytes) => {
    const now = performance.now();
    speedTrackerRef.current.push({ timestamp: now, bytes });

    // Keep only the last 10 samples for rolling average
    if (speedTrackerRef.current.length > 10) {
      speedTrackerRef.current.shift();
    }

    if (speedTrackerRef.current.length > 1) {
      const first = speedTrackerRef.current[0];
      const last = speedTrackerRef.current[speedTrackerRef.current.length - 1];
      const timeDiffSec = (last.timestamp - first.timestamp) / 1000;

      if (timeDiffSec > 0) {
        const totalBytes = speedTrackerRef.current.reduce((acc, curr) => acc + curr.bytes, 0);
        setSpeed(totalBytes / timeDiffSec);
      }
    }
  };

  // ── Sender flow ──────────────────────────────────────────────────
  const startSending = useCallback(async (file) => {
    try {
      setStatus('hashing');
      setError(null);
      setProgress(0);
      setBytesTransferred(0);
      setSpeed(0);
      speedTrackerRef.current = [];

      const fileHash = await hashFile(file);
      const totalChunks = getChunkCount(file.size);

      const metadataMsg = encodeMetadata({
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        fileHash,
        mimeType: file.type,
      });

      await sendData(metadataMsg);
      setStatus('transferring');

      let transferred = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunkBuffer = await readChunk(file, i);
        const encoded = encodeChunk(i, chunkBuffer);
        await sendData(encoded);  // backpressure-aware (see useWebRTC.sendData)

        transferred += chunkBuffer.byteLength;
        setBytesTransferred(transferred);
        setProgress(((i + 1) / totalChunks) * 100);
        updateSpeed(chunkBuffer.byteLength);
      }

      await sendData(encodeComplete());
      setStatus('complete');

    } catch (err) {
      console.error('[Transfer] Send error:', err);
      setStatus('error');
      setError(err.message || 'Error sending file');
      try {
        await sendData(encodeError(err.message || 'Error sending file'));
      } catch (e) {
        // DataChannel may already be closed — expected after disconnect
      }
    }
  }, [sendData]);

  // ── Reset ────────────────────────────────────────────────────────
  const resetTransfer = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setSpeed(0);
    setBytesTransferred(0);
    setError(null);
    setFileInfo(null);
    receivedChunksRef.current = [];
    receivedCountRef.current = 0;
    speedTrackerRef.current = [];
    metadataRef.current = null;
  }, []);

  // ── Receiver flow (DataChannel message handler) ──────────────────
  useEffect(() => {
    if (!onDataRef) return;

    onDataRef.current = async (data) => {
      try {
        const message = decodeMessage(data);

        if (message.type === 'metadata') {
          const meta = {
            fileName: message.fileName,
            fileSize: message.fileSize,
            totalChunks: message.totalChunks,
            fileHash: message.fileHash,
            mimeType: message.mimeType,
          };
          console.log('[Transfer] Received metadata:', meta.fileName,
            `(${meta.fileSize} bytes, ${meta.totalChunks} chunks)`);

          metadataRef.current = meta;
          setFileInfo(meta);
          receivedChunksRef.current = new Array(meta.totalChunks);
          receivedCountRef.current = 0;
          setStatus('transferring');
          setProgress(0);
          setBytesTransferred(0);
          setSpeed(0);
          speedTrackerRef.current = [];
          setError(null);

        } else if (message.type === 'chunk') {
          const { index, data: chunkData } = message;

          // Dedup safety: only count each slot once
          if (!receivedChunksRef.current[index]) {
            receivedCountRef.current++;
          }
          receivedChunksRef.current[index] = chunkData;

          // ⚠️ TEMPORARY TEST: corrupt chunk 5 to verify hash-mismatch detection
          // DELETE THIS LINE after testing!
          if (index === 5) receivedChunksRef.current[5] = new ArrayBuffer(chunkData.byteLength);

          setBytesTransferred(prev => prev + chunkData.byteLength);

          // Bug 6 fix: O(1) progress from counter ref
          const total = receivedChunksRef.current.length;
          if (total > 0) {
            setProgress((receivedCountRef.current / total) * 100);
          }

          updateSpeed(chunkData.byteLength);

        } else if (message.type === 'complete') {
          const meta = metadataRef.current;

          if (!meta) {
            setStatus('error');
            setError('Received completion signal but no metadata was received');
            return;
          }

          // ────────────────────────────────────────────────────────
          // Bug 3 fix: guard against incomplete transfers.
          // On a reliable, ordered DataChannel, chunk drops shouldn't
          // happen — but an abrupt disconnect can leave us with a
          // partial chunk array. Without this guard, undefined slots
          // silently coerce to "undefined" strings in the Blob,
          // producing a confusing "hash mismatch" instead of a clear
          // "incomplete transfer" message.
          // ────────────────────────────────────────────────────────
          if (receivedCountRef.current !== meta.totalChunks) {
            setStatus('error');
            setError(
              `Incomplete transfer — received ${receivedCountRef.current} of ` +
              `${meta.totalChunks} chunks. The sender may have disconnected.`
            );
            return;
          }

          setStatus('verifying');

          // Assemble all chunks into a single buffer for hash verification
          const totalLength = receivedChunksRef.current.reduce(
            (acc, chunk) => acc + chunk.byteLength, 0
          );
          const combinedBuffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of receivedChunksRef.current) {
            combinedBuffer.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          const actualHash = await hashChunk(combinedBuffer.buffer);

          if (actualHash === meta.fileHash) {
            console.log('[Transfer] Hash verified ✓');
            setStatus('complete');
            assembleAndDownload(
              receivedChunksRef.current,
              meta.fileName,
              meta.mimeType
            );
          } else {
            console.error('[Transfer] Hash mismatch!',
              'expected:', meta.fileHash, 'got:', actualHash);
            setStatus('error');
            setError('File integrity check failed — SHA-256 hash mismatch');
          }

        } else if (message.type === 'error') {
          setStatus('error');
          setError(message.message || 'Peer reported an error');
        }
      } catch (err) {
        console.error('[Transfer] Receive error:', err);
        setStatus('error');
        setError(err.message || 'Error processing received message');
      }
    };
  }, [onDataRef]);

  return {
    status,
    progress,
    speed,
    bytesTransferred,
    error,
    fileInfo,
    startSending,
    resetTransfer,
  };
}
