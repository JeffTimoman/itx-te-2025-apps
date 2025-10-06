const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// In-memory storage (for testing without Redis)
class InMemoryStorage {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async setEx(key, ttl, value) {
    this.data.set(key, value);
    // In production, you would implement TTL here
    return 'OK';
  }

  async del(key) {
    return this.data.delete(key);
  }

  async keys(pattern) {
    const keys = Array.from(this.data.keys());
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return keys.filter(key => key.startsWith(prefix));
    }
    return keys;
  }

  get isOpen() {
    return true;
  }
}

// Use in-memory storage if Redis is not available
const storage = new InMemoryStorage();
console.log('Using in-memory storage (Redis not connected)');

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
const gameManager = new GameManager(storage);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    storage: 'in-memory',
    note: 'Redis not connected - using in-memory storage for development'
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
      const result = await gameManager.startGame(roomId, socket.id);
      
      if (result.success) {
        io.to(roomId).emit('gameStarted', { 
          gameState: result.gameState,
          startTime: Date.now()
        });
        
        // Set game end timer
        setTimeout(async () => {
          const endResult = await gameManager.endGame(roomId);
          if (endResult.success) {
            io.to(roomId).emit('gameEnded', { 
              results: endResult.results,
              winner: endResult.winner
            });
          }
        }, process.env.GAME_DURATION || 30000);
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
      await gameManager.handleDisconnect(socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Note: Using in-memory storage. Install Redis for production use.');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});