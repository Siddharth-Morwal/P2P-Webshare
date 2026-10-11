import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

// Signaling server URL - in dev, Vite proxy handles /socket.io
// In production, set VITE_SIGNALING_URL env var
const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || '';

export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [error, setError] = useState(null);
  const [peerJoined, setPeerJoined] = useState(false);

  // Callback refs for signaling events (set by useWebRTC)
  const onOfferRef = useRef(null);
  const onAnswerRef = useRef(null);
  const onIceCandidateRef = useRef(null);
  const onPeerJoinedRef = useRef(null);
  const onPeerLeftRef = useRef(null);

  useEffect(() => {
    const socket = io(SIGNALING_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setError('Failed to connect to signaling server');
    });

    socket.on('room-created', ({ roomId: id }) => {
      console.log('[Socket] Room created:', id);
      setRoomId(id);
    });

    socket.on('room-joined', ({ roomId: id }) => {
      console.log('[Socket] Joined room:', id);
      setRoomId(id);
    });

    socket.on('peer-joined', () => {
      console.log('[Socket] Peer joined');
      setPeerJoined(true);
      onPeerJoinedRef.current?.();
    });

    socket.on('peer-left', () => {
      console.log('[Socket] Peer left');
      setPeerJoined(false);
      onPeerLeftRef.current?.();
    });

    socket.on('offer', ({ offer }) => {
      console.log('[Socket] Received offer');
      onOfferRef.current?.(offer);
    });

    socket.on('answer', ({ answer }) => {
      console.log('[Socket] Received answer');
      onAnswerRef.current?.(answer);
    });

    socket.on('ice-candidate', ({ candidate }) => {
      onIceCandidateRef.current?.(candidate);
    });

    socket.on('error', (msg) => {
      console.error('[Socket] Server error:', msg);
      setError(msg);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createRoom = useCallback(() => {
    socketRef.current?.emit('create-room');
  }, []);

  const joinRoom = useCallback((id) => {
    socketRef.current?.emit('join-room', { roomId: id });
  }, []);

  const sendOffer = useCallback((roomId, offer) => {
    socketRef.current?.emit('offer', { roomId, offer });
  }, []);

  const sendAnswer = useCallback((roomId, answer) => {
    socketRef.current?.emit('answer', { roomId, answer });
  }, []);

  const sendIceCandidate = useCallback((roomId, candidate) => {
    socketRef.current?.emit('ice-candidate', { roomId, candidate });
  }, []);

  return {
    isConnected,
    roomId,
    error,
    peerJoined,
    createRoom,
    joinRoom,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    // Callback setters for WebRTC hook to register handlers
    onOfferRef,
    onAnswerRef,
    onIceCandidateRef,
    onPeerJoinedRef,
    onPeerLeftRef,
  };
}
