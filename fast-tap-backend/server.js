const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const redis = require('redis');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Redis Client Setup (only enabled when ENABLE_REDIS=true)
let redisClient = null;
const enableRedis = (process.env.ENABLE_REDIS || 'false').toLowerCase() === 'true';
if (enableRedis) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    }
  });

  // Connect to Redis
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });

  // Initialize Redis connection
  (async () => {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // If connect fails, disable redis usage to fall back to in-memory
      try { await redisClient.quit(); } catch (e) {}
      redisClient = null;
    }
  })();
} else {
  console.log('Redis disabled (ENABLE_REDIS!=true). Using in-memory storage fallback.');
}

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: corsOptions
});

// Import game logic
const GameManager = require('./src/gameManager');
const gameManager = new GameManager(redisClient);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    redis: redisClient && redisClient.isOpen ? 'connected' : 'disabled'
  });
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await gameManager.getAllRooms();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join room
  socket.on('joinRoom', async (data) => {
    try {
      const { roomId, playerName } = data;
      const result = await gameManager.joinRoom(socket.id, roomId, playerName);
      
      if (result.success) {
        socket.join(roomId);
        socket.emit('joinedRoom', { 
          roomId, 
          playerId: socket.id,
          playerName,
          room: result.room 
        });
        
        // Notify other players in the room
        socket.to(roomId).emit('playerJoined', { 
          playerId: socket.id, 
          playerName,
          room: result.room
        });
        // If a game is currently active for this room, send the game state to the joining socket so it can sync
        try {
          const gameState = await gameManager.getGameState(roomId);
          if (gameState && gameState.status === 'playing') {
            // indicate this client joined mid-round
            socket.emit('gameStarted', { gameState, startTime: gameState.startTime, durationMs: gameState.duration, isMidJoin: true });
          }
        } catch (e) {
          console.warn('Failed to send gameState to joining client', e && e.message);
        }
      } else {
        socket.emit('joinRoomError', { message: result.message });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('joinRoomError', { message: 'Failed to join room' });
    }
  });

  // Create room
  socket.on('createRoom', async (data) => {
    try {
      const { playerName } = data;
      const result = await gameManager.createRoom(socket.id, playerName);
      
      if (result.success) {
        socket.join(result.roomId);
        socket.emit('roomCreated', { 
          roomId: result.roomId, 
          playerId: socket.id,
          playerName,
          room: result.room
        });
      } else {
        socket.emit('createRoomError', { message: result.message });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('createRoomError', { message: 'Failed to create room' });
    }
  });

  // Start game
  socket.on('startGame', async (data) => {
    try {
      const { roomId } = data;
      const duration = Number(data.duration) || 30; // seconds
      console.log(`startGame requested by ${socket.id} for room ${roomId} durationSeconds=${duration}`);
      const result = await gameManager.startGame(roomId, socket.id, duration);
      console.log('startGame result:', result && result.success ? 'success' : 'failed', result && result.gameState ? { duration: result.gameState.duration, startTime: result.gameState.startTime } : result);
      
      if (result.success) {
        // Log chosen duration for debugging
        try { console.log(`Starting game ${roomId} durationMs=${result.gameState.duration}`); } catch(e) {}
        io.to(roomId).emit('gameStarted', { 
          gameState: result.gameState,
          // send the authoritative startTime and durationMs from gameState
          startTime: result.gameState.startTime,
          durationMs: result.gameState.duration,
          durationSeconds: Math.round((result.gameState.duration || 0) / 1000)
        });
        
        // Set game end timer based on gameState.duration (ms)
        const durationMs = result.gameState.duration || 30000;
        const timer = setTimeout(async () => {
          // On timeout, check room state first
          const room = await gameManager.getRoom(roomId);
          if (!room) return;
          if (room.firstTap) {
            // Someone already tapped (race), end game normally
            const endResult = await gameManager.endGame(roomId);
            if (endResult.success) {
              io.to(roomId).emit('gameEnded', {
                results: endResult.results,
                winner: endResult.winner
              });
            }
          } else {
            // No one tapped during the timer: emit an event indicating time expired with no taps
            // Put the room into a 'post' phase where taps are allowed and the first tap will still win/stop everyone.
            io.to(roomId).emit('timeExpiredNoTap', { message: 'Time expired with no taps' });
            try {
              room.status = 'post';
              // keep gameStartTime and gameDuration if you want for reference; remove if not needed
+              await gameManager._setEx(`${gameManager.ROOM_PREFIX}${roomId}`, 3600, JSON.stringify(room));
              // Inform clients that post-timer tapping is now open
              io.to(roomId).emit('postTimerOpen', { message: 'Timer ended — first tap now wins' });
            } catch (e) {
              console.warn('Failed to set room to post state after empty timeout', e && e.message);
            }
          }
        }, durationMs);

        // Store timer reference in memory so we could clear if first tap happens
        if (!global._gameTimers) global._gameTimers = {};
        global._gameTimers[roomId] = timer;
      } else {
        socket.emit('startGameError', { message: result.message });
      }
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('startGameError', { message: 'Failed to start game' });
    }
  });

  // Player tap
  socket.on('tap', async (data) => {
    try {
      const { roomId } = data;
      const result = await gameManager.registerTap(roomId, socket.id);
      
      if (result.success) {
        // If this tap created the firstTap, clear timer and immediately end the round
        if (result.firstTap) {
          // clear timer
          if (global._gameTimers && global._gameTimers[roomId]) {
            clearTimeout(global._gameTimers[roomId]);
            delete global._gameTimers[roomId];
          }
          // announce first tap and disable taps for everyone
          io.to(roomId).emit('firstTap', {
            playerId: result.firstTap.playerId,
            playerName: result.firstTap.playerName,
            timestamp: result.firstTap.timestamp
          });
          io.to(roomId).emit('disableTaps', { message: 'First tap received' });

          // Immediately end the game and broadcast results
          const endResult = await gameManager.endGame(roomId);
          if (endResult.success) {
            io.to(roomId).emit('gameEnded', {
              results: endResult.results,
              winner: endResult.winner
            });
          }
        }
        // Broadcast tap to all players in the room
        io.to(roomId).emit('tapRegistered', { 
          playerId: socket.id,
          tapCount: result.tapCount,
          leaderboard: result.leaderboard
        });
      }
    } catch (error) {
      console.error('Error registering tap:', error);
    }
  });

  // Admin resets the round (clear firstTap and re-enable taps)
  socket.on('resetRound', async (data) => {
    try {
      const { roomId } = data;
      const room = await gameManager.getRoom(roomId);
      if (!room) return;
      delete room.firstTap;
  delete room.awaitingAnswer;
  // reset status to waiting so next round can be started fresh
  room.status = 'waiting';
  delete room.gameStartTime;
  delete room.gameDuration;
      // reset tap counts
      Object.keys(room.players).forEach(pid => {
        room.players[pid].tapCount = 0;
      });
      await gameManager._setEx(`${gameManager.ROOM_PREFIX}${roomId}`, 3600, JSON.stringify(room));
      io.to(roomId).emit('roundReset', { message: 'Round has been reset by admin', room });
    } catch (err) {
      console.error('Error resetting round', err);
    }
  });

  // Admin ends the game and kicks all players (except the admin) from the room
  socket.on('endGame', async (data) => {
    try {
      const { roomId } = data;
      const room = await gameManager.getRoom(roomId);
      if (!room) {
        socket.emit('endGameError', { message: 'Room not found' });
        return;
      }
      // Only the host can forcibly end the game
      if (room.host !== socket.id) {
        socket.emit('endGameError', { message: 'Only the host can end the game' });
        return;
      }

      // Iterate over players and remove/disconnect them (except host)
      const playerIds = Object.keys(room.players || {});
      for (const pid of playerIds) {
        if (pid === socket.id) continue;
        try {
          // Remove from room in storage
          await gameManager.leaveRoom(roomId, pid);
        } catch (e) {
          // ignore per-player errors
        }

        // Attempt to find and disconnect their socket
        try {
          const playerSocket = io.sockets.sockets.get(pid);
          if (playerSocket) {
            try {
              playerSocket.emit('kicked', { message: 'The admin ended the game' });
            } catch (e) {}
            try { playerSocket.leave(roomId); } catch (e) {}
            try { playerSocket.disconnect(true); } catch (e) {}
          }
        } catch (e) {
          // ignore
        }
      }

      // Refresh room state and notify remaining clients (admin)
      const updated = await gameManager.getRoom(roomId);
      io.to(roomId).emit('roomEnded', { message: 'Game ended by admin', room: updated });
      socket.emit('endGameAck', { success: true });
    } catch (err) {
      console.error('Error ending game', err);
      socket.emit('endGameError', { message: 'Failed to end game' });
    }
  });

  // Leave room
  socket.on('leaveRoom', async (data) => {
    try {
      const { roomId } = data;
      const result = await gameManager.leaveRoom(roomId, socket.id);
      
      if (result.success) {
        socket.leave(roomId);
        socket.to(roomId).emit('playerLeft', { 
          playerId: socket.id,
          room: result.room
        });
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    try {
      const result = await gameManager.handleDisconnect(socket.id);
      // If handleDisconnect returned a leaveRoom result with room info, notify other clients
      if (result && result.success && result.room) {
        const roomId = result.room.id || result.roomId;
        try { io.to(roomId).emit('playerLeft', { playerId: socket.id, room: result.room }); } catch (e) { }
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  try {
    if (redisClient && redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.warn('Error quitting Redis client on SIGTERM:', err && err.message);
  }
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  try {
    if (redisClient && redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.warn('Error quitting Redis client on SIGINT:', err && err.message);
  }
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});