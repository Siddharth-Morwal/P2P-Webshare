import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomForSocket,
  getActiveRoomsCount
} from './rooms.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Hardening: cap message size at 64KB. Signaling payloads (SDP, ICE)
  // are typically 2-5KB. This prevents any possibility of file data
  // being relayed through the signaling server, even via a buggy or
  // malicious client. File data flows only over WebRTC DataChannel.
  maxHttpBufferSize: 64 * 1024,
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: getActiveRoomsCount()
  });
});

io.on('connection', (socket) => {
  console.log(`Socket ${socket.id} connected`);

  socket.on('create-room', () => {
    const roomId = createRoom();
    // Also join the room explicitly as the creator
    const result = joinRoom(roomId, socket.id);
    if (result.success) {
      socket.join(roomId);
      socket.emit('room-created', { roomId });
      console.log(`Room ${roomId} created by ${socket.id}`);
    } else {
      socket.emit('error', 'Failed to create room internally');
    }
  });

  socket.on('join-room', ({ roomId }) => {
    const result = joinRoom(roomId, socket.id);
    
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      socket.join(roomId);
      socket.emit('room-joined', { roomId });
      socket.to(roomId).emit('peer-joined');
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    }
  });

  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });

  socket.on('disconnect', () => {
    const roomId = getRoomForSocket(socket.id);
    if (roomId) {
      socket.to(roomId).emit('peer-left');
      leaveRoom(roomId, socket.id);
      console.log(`Socket ${socket.id} disconnected from room ${roomId}`);
    } else {
      console.log(`Socket ${socket.id} disconnected without a room`);
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
