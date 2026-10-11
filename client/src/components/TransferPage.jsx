import { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useFileTransfer } from '../hooks/useFileTransfer';
import Dropzone from './Dropzone';
import FileInfo from './FileInfo';
import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';
import RoomLink from './RoomLink';

export default function TransferPage({ mode, initialRoomId }) {
  const isSender = mode === 'sender';
  const [file, setFile] = useState(null);

  // --- Hook wiring ---
  const socket = useSocket();
  const webrtc = useWebRTC(socket, isSender);
  const fileTransfer = useFileTransfer(webrtc);

  // --- Derive overall status from hook states ---
  const overallStatus = useMemo(() => {
    // Error states
    if (socket.error === 'room-not-found') return 'room-not-found';
    if (socket.error === 'room-full') return 'error';
    if (fileTransfer.status === 'error') return 'error';
    if (webrtc.connectionState === 'failed') return 'error';

    // Disconnect
    if (webrtc.connectionState === 'disconnected' && fileTransfer.status !== 'complete') {
      return 'disconnected';
    }

    // Transfer states take priority when active
    if (fileTransfer.status === 'complete') return 'complete';
    if (fileTransfer.status === 'verifying') return 'verifying';
    if (fileTransfer.status === 'transferring') return 'transferring';
    if (fileTransfer.status === 'hashing') return 'transferring';

    // Connection states
    if (webrtc.dataChannelReady) return 'connected';
    if (webrtc.connectionState === 'connecting') return 'connecting';

    // Room states
    if (socket.roomId && socket.peerJoined) return 'connecting';
    if (socket.roomId && !socket.peerJoined) return 'waiting';

    // Socket connecting
    if (!socket.isConnected) return 'connecting';

    return 'idle';
  }, [
    socket.isConnected, socket.roomId, socket.peerJoined, socket.error,
    webrtc.connectionState, webrtc.dataChannelReady,
    fileTransfer.status,
  ]);

  // --- Receiver: auto-join room when socket connects ---
  useEffect(() => {
    if (!isSender && initialRoomId && socket.isConnected && !socket.roomId) {
      socket.joinRoom(initialRoomId);
    }
  }, [isSender, initialRoomId, socket.isConnected, socket.roomId, socket.joinRoom]);

  // --- Sender: auto-start transfer when DataChannel is ready ---
  useEffect(() => {
    if (isSender && webrtc.dataChannelReady && file && fileTransfer.status === 'idle') {
      fileTransfer.startSending(file);
    }
  }, [isSender, webrtc.dataChannelReady, file, fileTransfer.status, fileTransfer.startSending]);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
  };

  const handleShareFile = () => {
    if (file) {
      socket.createRoom();
    }
  };

  const resetHome = () => {
    window.location.href = '/';
  };

  // --- Derive FileInfo props ---
  // For sender: use the local File object
  // For receiver: build a pseudo-file object from fileTransfer.fileInfo
  const displayFile = isSender ? file : (fileTransfer.fileInfo ? {
    name: fileTransfer.fileInfo.fileName,
    size: fileTransfer.fileInfo.fileSize,
    type: fileTransfer.fileInfo.mimeType,
  } : null);

  const hashStatus = (() => {
    if (fileTransfer.status === 'hashing') return 'hashing';
    if (fileTransfer.status === 'verifying') return 'hashing';
    if (fileTransfer.status === 'complete') return 'verified';
    if (fileTransfer.status === 'error' && fileTransfer.error?.includes('hash')) return 'failed';
    return null;
  })();

  const totalBytes = fileTransfer.fileInfo?.fileSize || file?.size || 0;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white flex items-center">
            <span className="text-blue-500 mr-2">P2P</span> WebShare
          </h1>
          <StatusBadge status={overallStatus === 'room-not-found' ? 'error' : overallStatus} />
        </div>

        <div className="space-y-6">
          {/* Room not found (receiver) */}
          {overallStatus === 'room-not-found' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
              <h2 className="text-red-400 text-lg font-medium mb-2">Room Not Found</h2>
              <p className="text-gray-400 mb-4">
                The room link might be invalid or the sender has disconnected.
              </p>
              <button onClick={resetHome} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors">
                Back to Home
              </button>
            </div>
          )}

          {/* Sender: idle — show dropzone */}
          {isSender && overallStatus === 'idle' && (
            <div className="space-y-6">
              <Dropzone onFileSelect={handleFileSelect} disabled={false} />
              {file && <FileInfo file={file} hashStatus={null} fileHash={null} />}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleShareFile}
                  disabled={!file}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    file
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Create Transfer Room
                </button>
              </div>
            </div>
          )}

          {/* Sender: waiting for peer */}
          {isSender && overallStatus === 'waiting' && (
            <div className="space-y-6">
              {file && <FileInfo file={file} hashStatus={null} fileHash={null} />}
              {socket.roomId && <RoomLink roomId={socket.roomId} />}
              <div className="text-center mt-4">
                <p className="text-gray-400 text-sm">
                  Send this link to the receiver. The transfer will start automatically when they connect.
                </p>
              </div>
            </div>
          )}

          {/* Receiver: connecting */}
          {!isSender && (overallStatus === 'idle' || overallStatus === 'connecting' || overallStatus === 'waiting') && overallStatus !== 'room-not-found' && (
            <div className="text-center py-10">
              <div className="inline-block relative w-16 h-16 mb-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></span>
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-medium text-white mb-2">Connecting to Sender...</h2>
              <p className="text-gray-400">Establishing a secure peer-to-peer connection.</p>
            </div>
          )}

          {/* Both: transfer in progress / complete */}
          {(overallStatus === 'connected' || overallStatus === 'transferring' || overallStatus === 'verifying' || overallStatus === 'complete') && (
            <div className="space-y-6">
              {displayFile && (
                <FileInfo
                  file={displayFile}
                  hashStatus={hashStatus}
                  fileHash={fileTransfer.fileInfo?.fileHash || null}
                />
              )}

              <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
                <ProgressBar
                  progress={fileTransfer.progress}
                  speed={fileTransfer.speed}
                  bytesTransferred={fileTransfer.bytesTransferred}
                  totalBytes={totalBytes}
                  status={fileTransfer.status === 'idle' ? 'transferring' : fileTransfer.status}
                />
              </div>

              {overallStatus === 'complete' && (
                <div className="text-center pt-4">
                  <p className="text-emerald-400 mb-4">
                    {isSender ? '✓ File sent successfully!' : '✓ File downloaded successfully!'}
                  </p>
                  <button onClick={resetHome} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition-colors">
                    Start New Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Disconnected / Error */}
          {(overallStatus === 'disconnected' || (overallStatus === 'error' && socket.error !== 'room-not-found')) && (
            <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20 mb-4">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-white text-lg font-medium mb-2">
                {overallStatus === 'disconnected' ? 'Connection Lost' : 'Transfer Error'}
              </h2>
              <p className="text-gray-400 mb-6">
                {overallStatus === 'disconnected'
                  ? 'The peer disconnected before the transfer could finish.'
                  : (fileTransfer.error || socket.error || 'An unexpected error occurred.')}
              </p>
              <button onClick={resetHome} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors">
                Back to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
