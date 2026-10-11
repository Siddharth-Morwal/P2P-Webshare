import crypto from 'crypto';

const rooms = new Map(); // Map<roomId, { sockets: Set<socketId>, createdAt: Date }>

export function createRoom() {
  let roomId;
  do {
    roomId = crypto.randomBytes(3).toString('hex');
  } while (rooms.has(roomId));
  
  rooms.set(roomId, {
    sockets: new Set(),
    createdAt: new Date()
  });
  
  return roomId;
}

export function joinRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) {
    return { error: 'room-not-found' };
  }
  
  if (room.sockets.size >= 2) {
    return { error: 'room-full' };
  }
  
  room.sockets.add(socketId);
  return { success: true };
}

export function leaveRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (room) {
    room.sockets.delete(socketId);
    if (room.sockets.size === 0) {
      rooms.delete(roomId);
    }
  }
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function getPeer(roomId, socketId) {
  const room = rooms.get(roomId);
  if (room) {
    for (const sid of room.sockets) {
      if (sid !== socketId) {
        return sid;
      }
    }
  }
  return null;
}

export function getRoomForSocket(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.sockets.has(socketId)) {
      return roomId;
    }
  }
  return null;
}

export function getActiveRoomsCount() {
  return rooms.size;
}
