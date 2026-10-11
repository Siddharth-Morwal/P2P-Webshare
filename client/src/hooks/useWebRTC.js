import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN server placeholder — uncomment and add credentials for production.
  // See README.md "Known Limitations" for why TURN is skipped in MVP.
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'user',
  //   credential: 'pass',
  // },
];

const BUFFER_THRESHOLD = 128 * 1024; // 128KB — pause sending above this

export function useWebRTC(socket, isSender) {
  const {
    roomId,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    onOfferRef,
    onAnswerRef,
    onIceCandidateRef,
    onPeerJoinedRef,
    onPeerLeftRef,
  } = socket;

  const [connectionState, setConnectionState] = useState('new');
  const [dataChannelReady, setDataChannelReady] = useState(false);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const onDataRef = useRef(null);

  const pendingCandidatesRef = useRef([]);
  const isRemoteDescriptionSetRef = useRef(false);

  // ──────────────────────────────────────────────────────────────────
  // Bug 1 fix: read roomId and socket send functions from refs so
  // initPeerConnection doesn't depend on them. Without this, every
  // roomId change (null → "abc123") tears down and re-creates the
  // RTCPeerConnection, destroying registered callback refs.
  // ──────────────────────────────────────────────────────────────────
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const sendOfferRef = useRef(sendOffer);
  const sendAnswerRef = useRef(sendAnswer);
  const sendIceCandidateRef = useRef(sendIceCandidate);
  useEffect(() => { sendOfferRef.current = sendOffer; }, [sendOffer]);
  useEffect(() => { sendAnswerRef.current = sendAnswer; }, [sendAnswer]);
  useEffect(() => { sendIceCandidateRef.current = sendIceCandidate; }, [sendIceCandidate]);

  const setupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 64 * 1024; // 64KB

    dc.onopen = () => {
      console.log('[WebRTC] DataChannel open');
      dcRef.current = dc;
      setDataChannelReady(true);
    };

    dc.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
      setDataChannelReady(false);
      dcRef.current = null;
    };

    dc.onerror = (event) => {
      console.error('[WebRTC] DataChannel error:', event);
    };

    dc.onmessage = (event) => {
      onDataRef.current?.(event.data);
    };
  }, []);

  const processPendingCandidates = useCallback(async (pc) => {
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error('[WebRTC] Error adding pending ICE candidate:', err);
      }
    }
    pendingCandidatesRef.current = [];
  }, []);

  // ──────────────────────────────────────────────────────────────────
  // initPeerConnection: creates the RTCPeerConnection ONCE per mount.
  // All values that change after mount (roomId, socket functions) are
  // read from refs, NOT from the closure's captured values.
  // ──────────────────────────────────────────────────────────────────
  const initPeerConnection = useCallback(() => {
    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && roomIdRef.current) {
          sendIceCandidateRef.current(roomIdRef.current, event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        setConnectionState(pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          setDataChannelReady(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      };

      if (isSender) {
        // Sender: create DataChannel + offer when peer joins
        onPeerJoinedRef.current = async () => {
          try {
            console.log('[WebRTC] Peer joined — creating DataChannel + offer');
            const dc = pc.createDataChannel('fileTransfer', { ordered: true });
            setupDataChannel(dc);

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (roomIdRef.current) {
              sendOfferRef.current(roomIdRef.current, offer);
            }
          } catch (err) {
            console.error('[WebRTC] Error creating offer:', err);
            setConnectionState('failed');
          }
        };
      } else {
        // Receiver: accept DataChannel from sender
        pc.ondatachannel = (event) => {
          console.log('[WebRTC] Received DataChannel from sender');
          setupDataChannel(event.channel);
        };
      }

      // Receiver handles incoming offer
      onOfferRef.current = async (offer) => {
        if (isSender) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          isRemoteDescriptionSetRef.current = true;
          await processPendingCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (roomIdRef.current) {
            sendAnswerRef.current(roomIdRef.current, answer);
          }
        } catch (err) {
          console.error('[WebRTC] Error handling offer:', err);
          setConnectionState('failed');
        }
      };

      // Sender handles incoming answer
      onAnswerRef.current = async (answer) => {
        if (!isSender) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          isRemoteDescriptionSetRef.current = true;
          await processPendingCandidates(pc);
        } catch (err) {
          console.error('[WebRTC] Error handling answer:', err);
          setConnectionState('failed');
        }
      };

      // Both sides: queue ICE candidates until remote description is set
      onIceCandidateRef.current = async (candidate) => {
        try {
          const rtcCandidate = new RTCIceCandidate(candidate);
          if (isRemoteDescriptionSetRef.current) {
            await pc.addIceCandidate(rtcCandidate);
          } else {
            pendingCandidatesRef.current.push(rtcCandidate);
          }
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      };

      onPeerLeftRef.current = () => {
        console.log('[WebRTC] Peer left — marking disconnected');
        setConnectionState('disconnected');
        setDataChannelReady(false);
      };

    } catch (err) {
      console.error('[WebRTC] Error initializing peer connection:', err);
      setConnectionState('failed');
    }
  // ⚠️ Deliberately NO roomId/sendOffer/sendAnswer/sendIceCandidate here.
  // They are read from refs. Only isSender (immutable per mount) and
  // stable useCallback refs belong in this array.
  }, [isSender, setupDataChannel, processPendingCandidates,
      onPeerJoinedRef, onOfferRef, onAnswerRef, onIceCandidateRef, onPeerLeftRef]);

  const cleanup = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setDataChannelReady(false);
    setConnectionState('closed');
    isRemoteDescriptionSetRef.current = false;
    pendingCandidatesRef.current = [];
  }, []);

  const resetConnection = useCallback(() => {
    cleanup();
    initPeerConnection();
  }, [cleanup, initPeerConnection]);

  useEffect(() => {
    initPeerConnection();
    return cleanup;
  }, [initPeerConnection, cleanup]);

  // ──────────────────────────────────────────────────────────────────
  // Bug 2 fix: sendData rejects if DataChannel closes or errors
  // while we're waiting for the buffer to drain. Without this, the
  // sender's chunk loop hangs forever on peer disconnect during
  // backpressure, and the UI is stuck on "Transferring...".
  // ──────────────────────────────────────────────────────────────────
  const sendData = useCallback(async (data) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') {
      throw new Error('DataChannel not ready');
    }

    if (dc.bufferedAmount >= BUFFER_THRESHOLD) {
      await new Promise((resolve, reject) => {
        const removeAll = () => {
          dc.removeEventListener('bufferedamountlow', onLow);
          dc.removeEventListener('close', onClose);
          dc.removeEventListener('error', onError);
        };
        const onLow = () => {
          removeAll();
          resolve();
        };
        const onClose = () => {
          removeAll();
          reject(new Error('DataChannel closed while waiting for buffer drain'));
        };
        const onError = () => {
          removeAll();
          reject(new Error('DataChannel error while waiting for buffer drain'));
        };
        dc.addEventListener('bufferedamountlow', onLow);
        dc.addEventListener('close', onClose);
        dc.addEventListener('error', onError);
      });
    }

    dc.send(data);
  }, []);

  return {
    connectionState,
    dataChannelReady,
    sendData,
    onDataRef,
    resetConnection,
  };
}
