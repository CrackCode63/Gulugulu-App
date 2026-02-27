const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function leaveRoom(socket) {
  const { roomId, userId } = socket.data || {};
  if (!roomId || !userId) {
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.delete(userId);
  socket.leave(roomId);
  socket.to(roomId).emit('user-left', { userId });

  if (room.size === 0) {
    rooms.delete(roomId);
  }

  socket.data.roomId = null;
  socket.data.userId = null;
  socket.data.userName = null;
}

io.on('connection', (socket) => {
  socket.on('validate-room', ({ roomId }, callback) => {
    const normalizedRoomId = String(roomId || '').trim().toUpperCase();
    const isValid = Boolean(normalizedRoomId && rooms.has(normalizedRoomId));
    if (typeof callback === 'function') {
      callback({ isValid });
    }
  });

  socket.on('join-room', ({ roomId, userId, userName, allowCreate = true }) => {
    if (!roomId || !userId) {
      return;
    }

    const normalizedRoomId = String(roomId).trim().toUpperCase();
    if (!normalizedRoomId) {
      return;
    }

    if (!allowCreate && !rooms.has(normalizedRoomId)) {
      socket.emit('join-error', {
        message: 'Invalid room code. Please check and try again.',
      });
      return;
    }

    leaveRoom(socket);

    const room = getOrCreateRoom(normalizedRoomId);
    const existingUsers = Array.from(room.values()).map((participant) => ({
      userId: participant.userId,
      userName: participant.userName,
      micEnabled: participant.micEnabled,
      cameraEnabled: participant.cameraEnabled,
      handRaised: participant.handRaised,
    }));

    room.set(userId, {
      userId,
      userName: userName || 'Guest',
      socketId: socket.id,
      micEnabled: true,
      cameraEnabled: true,
      handRaised: false,
    });

    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;
    socket.data.userId = userId;
    socket.data.userName = userName || 'Guest';

    socket.emit('existing-users', existingUsers);
    socket.to(normalizedRoomId).emit('user-joined', {
      userId,
      userName: userName || 'Guest',
    });
  });

  socket.on('offer', ({ targetUserId, sdp }) => {
    const { roomId, userId, userName } = socket.data || {};
    if (!roomId || !targetUserId || !sdp) {
      return;
    }

    const room = rooms.get(roomId);
    const target = room && room.get(targetUserId);
    if (!target) {
      return;
    }

    io.to(target.socketId).emit('offer', {
      fromUserId: userId,
      fromUserName: userName,
      sdp,
    });
  });

  socket.on('answer', ({ targetUserId, sdp }) => {
    const { roomId, userId } = socket.data || {};
    if (!roomId || !targetUserId || !sdp) {
      return;
    }

    const room = rooms.get(roomId);
    const target = room && room.get(targetUserId);
    if (!target) {
      return;
    }

    io.to(target.socketId).emit('answer', {
      fromUserId: userId,
      sdp,
    });
  });

  socket.on('ice-candidate', ({ targetUserId, candidate }) => {
    const { roomId, userId } = socket.data || {};
    if (!roomId || !targetUserId || !candidate) {
      return;
    }

    const room = rooms.get(roomId);
    const target = room && room.get(targetUserId);
    if (!target) {
      return;
    }

    io.to(target.socketId).emit('ice-candidate', {
      fromUserId: userId,
      candidate,
    });
  });

  socket.on('media-state', ({ micEnabled, cameraEnabled }) => {
    const { roomId, userId } = socket.data || {};
    if (!roomId || !userId) {
      return;
    }

    const room = rooms.get(roomId);
    const participant = room && room.get(userId);
    if (!participant) {
      return;
    }

    participant.micEnabled = Boolean(micEnabled);
    participant.cameraEnabled = Boolean(cameraEnabled);

    socket.to(roomId).emit('media-state', {
      userId,
      micEnabled: participant.micEnabled,
      cameraEnabled: participant.cameraEnabled,
    });
  });

  socket.on('raise-hand', ({ handRaised }) => {
    const { roomId, userId } = socket.data || {};
    if (!roomId || !userId) {
      return;
    }

    const room = rooms.get(roomId);
    const participant = room && room.get(userId);
    if (!participant) {
      return;
    }

    participant.handRaised = Boolean(handRaised);
    io.to(roomId).emit('raise-hand', {
      userId,
      handRaised: participant.handRaised,
    });
  });

  socket.on('chat-message', ({ message }) => {
    const { roomId, userId, userName } = socket.data || {};
    if (!roomId || !userId || !message || !String(message).trim()) {
      return;
    }

    io.to(roomId).emit('chat-message', {
      userId,
      userName: userName || 'Guest',
      message: String(message).trim().slice(0, 500),
      sentAt: Date.now(),
    });
  });

  socket.on('leave-room', () => {
    leaveRoom(socket);
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
