const { v4: uuidv4 } = require("uuid");

class GameManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.ROOM_PREFIX = "room:";
    this.PLAYER_PREFIX = "player:";
    this.GAME_PREFIX = "game:";
    // fallback to in-memory storage if redis client is not provided or not connected
    this.useMemory = !this.redis || (this.redis && !this.redis.isOpen);
    if (this.useMemory) {
      this.memoryRooms = new Map(); // key -> { value, expiresAt }
      this.memoryPlayers = new Map();
    }
  }

  // Get current game state for a room (if exists)
  async getGameState(roomId) {
    try {
      const data = await this._get(`${this.GAME_PREFIX}${roomId}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("Error getting game state:", err);
      return null;
    }
  }

  // Helper methods to abstract redis vs memory storage
  async _setEx(key, ttlSeconds, value) {
    if (this.useMemory) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      this.memoryRooms.set(key, { value, expiresAt });
      return "OK";
    }
    return await this.redis.setEx(key, ttlSeconds, value);
  }

  async _get(key) {
    if (this.useMemory) {
      const entry = this.memoryRooms.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.memoryRooms.delete(key);
        return null;
      }
      return entry.value;
    }
    return await this.redis.get(key);
  }

  async _del(key) {
    if (this.useMemory) {
      this.memoryRooms.delete(key);
      return 1;
    }
    return await this.redis.del(key);
  }

  async _keys(pattern) {
    if (this.useMemory) {
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
      const keys = [];
      for (const k of this.memoryRooms.keys()) {
        if (regex.test(k)) keys.push(k);
      }
      return keys;
    }
    return await this.redis.keys(pattern);
  }

  // Create a new room
  async createRoom(playerId, playerName) {
    try {
      // Use the provided playerName as the room code (normalize it)
      const raw = String(playerName || '').trim();
      // Normalize: uppercase, replace spaces with '-', allow A-Z,0-9 and '-'
      const roomId = raw.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').substring(0, 20);
      if (!roomId) return { success: false, message: 'Invalid room code' };

      // Ensure room code is unique
      const existing = await this._get(`${this.ROOM_PREFIX}${roomId}`);
      if (existing) {
        return { success: false, message: 'Room code already exists' };
      }
      const room = {
        id: roomId,
        host: playerId,
        players: {
          [playerId]: {
            id: playerId,
            name: playerName,
            tapCount: 0,
            isReady: false,
          },
        },
        status: "waiting", // waiting, playing, finished
        createdAt: Date.now(),
        maxPlayers: parseInt(process.env.MAX_PLAYERS_PER_ROOM) || 10,
      };

      await this._setEx(
        `${this.ROOM_PREFIX}${roomId}`,
        3600,
        JSON.stringify(room)
      );
      await this._setEx(`${this.PLAYER_PREFIX}${playerId}`, 3600, roomId);

      return { success: true, roomId, room };
    } catch (error) {
      console.error("Error creating room:", error);
      return { success: false, message: "Failed to create room" };
    }
  }

  // Join an existing room
  async joinRoom(playerId, roomId, playerName) {
    try {
      const roomKey = `${this.ROOM_PREFIX}${roomId}`;
      const roomData = await this._get(roomKey);

      if (!roomData) {
        return { success: false, message: "Room not found" };
      }

      const room = JSON.parse(roomData);

      // Enforce unique player names (case-insensitive)
      const nameTaken = Object.values(room.players).some(
        (p) =>
          p.name && p.name.toLowerCase() === String(playerName).toLowerCase()
      );
      if (nameTaken) {
        return { success: false, message: "Name already taken in this room" };
      }

      // Check if room is full
      if (Object.keys(room.players).length >= room.maxPlayers) {
        return { success: false, message: "Room is full" };
      }

      // Check if game is already in progress
      // Allow joining even if a game is in progress (participants may join mid-round)

      // Add player to room
      room.players[playerId] = {
        id: playerId,
        name: playerName,
        tapCount: 0,
        isReady: false,
      };

      await this._setEx(roomKey, 3600, JSON.stringify(room));
      await this._setEx(`${this.PLAYER_PREFIX}${playerId}`, 3600, roomId);

      return { success: true, room };
    } catch (error) {
      console.error("Error joining room:", error);
      return { success: false, message: "Failed to join room" };
    }
  }

  // Start the game
  // durationSeconds: number of seconds the game will accept taps (default 30)
  async startGame(roomId, hostId, durationSeconds = 30) {
    try {
      const roomKey = `${this.ROOM_PREFIX}${roomId}`;
      const roomData = await this._get(roomKey);

      if (!roomData) {
        return { success: false, message: "Room not found" };
      }

      const room = JSON.parse(roomData);

      // Check if user is the host
      if (room.host !== hostId) {
        return { success: false, message: "Only the host can start the game" };
      }

      // Check if there are enough players
      if (Object.keys(room.players).length < 1) {
        return { success: false, message: "Not enough players to start" };
      }

      // Update room status
      room.status = "playing";
      room.gameStartTime = Date.now();
      room.gameDuration = parseInt(durationSeconds) * 1000; // store ms

      // Reset all player tap counts
      // No tap counts needed — we only track the first tap
  // Clear any previous round's firstTap/awaitingAnswer so a fresh round starts clean
  delete room.firstTap;
  delete room.awaitingAnswer;

      await this._setEx(roomKey, 3600, JSON.stringify(room));

      // Create game state
      const gameState = {
        roomId,
        status: "playing",
        players: room.players,
        startTime: room.gameStartTime,
        duration: room.gameDuration, // ms
      };

      await this._setEx(
        `${this.GAME_PREFIX}${roomId}`,
        3600,
        JSON.stringify(gameState)
      );

      return { success: true, gameState };
    } catch (error) {
      console.error("Error starting game:", error);
      return { success: false, message: "Failed to start game" };
    }
  }

  // Register a tap
  async registerTap(roomId, playerId) {
    try {
      const roomKey = `${this.ROOM_PREFIX}${roomId}`;
      const roomData = await this._get(roomKey);

      if (!roomData) {
        return { success: false, message: "Room not found" };
      }

      const room = JSON.parse(roomData);

      // Check if game is in post-timer phase only (taps are only allowed after the timer ends)
      if (room.status !== "post") {
        return {
          success: false,
          message: "Taps are not allowed until the timer ends",
        };
      }

      // Prevent the last round's winner from tapping again until an admin resets the round
      if (room.lastWinner && room.lastWinner === playerId) {
        return {
          success: false,
          message: "You cannot tap because you already tapped in the last round",
        };
      }

      // Check if player is in the room
      if (!room.players[playerId]) {
        return { success: false, message: "Player not in room" };
      }

      // If a first tap already occurred, ignore additional taps
      if (room.firstTap) {
        return {
          success: false,
          message: "Tap ignored, first tap already registered",
        };
      }

      // If this is the first tap, record it and mark awaitingAnswer (do NOT finish the round)
      if (!room.firstTap) {
        const ts = Date.now();
        room.firstTap = {
          playerId,
          playerName: room.players[playerId].name,
          timestamp: ts,
        };
        // mark that we are awaiting the answer from the first tapper
        room.awaitingAnswer = true;
      }

      await this._setEx(roomKey, 3600, JSON.stringify(room));

      return {
        success: true,
        firstTap: room.firstTap,
      };
    } catch (error) {
      console.error("Error registering tap:", error);
      return { success: false, message: "Failed to register tap" };
    }
  }

  // End the game
  async endGame(roomId) {
    try {
      const roomKey = `${this.ROOM_PREFIX}${roomId}`;
      const roomData = await this._get(roomKey);

      if (!roomData) {
        return { success: false, message: "Room not found" };
      }

      const room = JSON.parse(roomData);

      // Update room status
      room.status = "finished";
      room.gameEndTime = Date.now();

      // Determine winner from the recorded firstTap if present
      let winner = null;
      if (room.firstTap) {
        winner = {
          playerId: room.firstTap.playerId,
          playerName: room.firstTap.playerName,
        };
      }

      // Record the last round winner on the room so they can be blocked until reset
      if (winner && winner.playerId) {
        room.lastWinner = winner.playerId;
      }

      await this._setEx(roomKey, 3600, JSON.stringify(room));

      // Return a simple list of players (no scores) and the winner (firstTap)
      const players = Object.values(room.players).map(p => ({ playerId: p.id, playerName: p.name }));
      return { success: true, results: players, winner };
    } catch (error) {
      console.error("Error ending game:", error);
      return { success: false, message: "Failed to end game" };
    }
  }

  // Leave room
  async leaveRoom(roomId, playerId) {
    try {
      const roomKey = `${this.ROOM_PREFIX}${roomId}`;
      const roomData = await this._get(roomKey);

      if (!roomData) {
        return { success: false, message: "Room not found" };
      }

      const room = JSON.parse(roomData);

      // Remove player from room
      delete room.players[playerId];

      // If room is empty, delete it
      if (Object.keys(room.players).length === 0) {
        await this._del(roomKey);
        await this._del(`${this.GAME_PREFIX}${roomId}`);
      } else {
        // If the host left, assign new host
        if (room.host === playerId) {
          const playerIds = Object.keys(room.players);
          if (playerIds.length > 0) {
            room.host = playerIds[0];
          }
        }
        await this._setEx(roomKey, 3600, JSON.stringify(room));
      }

      // Remove player reference
      await this._del(`${this.PLAYER_PREFIX}${playerId}`);

      return { success: true, room };
    } catch (error) {
      console.error("Error leaving room:", error);
      return { success: false, message: "Failed to leave room" };
    }
  }

  // Handle player disconnect
  async handleDisconnect(playerId) {
    try {
  const roomId = await this._get(`${this.PLAYER_PREFIX}${playerId}`);
      if (roomId) {
        // return the leaveRoom result so callers can notify other clients
        const result = await this.leaveRoom(roomId, playerId);
        return result;
      }
      return null;
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  }

  // Get all active rooms
  async getAllRooms() {
    try {
      const keys = await this._keys(`${this.ROOM_PREFIX}*`);
      const rooms = [];

      for (const key of keys) {
        const roomData = await this._get(key);
        if (roomData) {
          const room = JSON.parse(roomData);
          rooms.push({
            id: room.id,
            playerCount: Object.keys(room.players).length,
            maxPlayers: room.maxPlayers,
            status: room.status,
            createdAt: room.createdAt,
          });
        }
      }

      return rooms;
    } catch (error) {
      console.error("Error getting all rooms:", error);
      return [];
    }
  }

  // Get room details
  async getRoom(roomId) {
    try {
      const roomData = await this._get(`${this.ROOM_PREFIX}${roomId}`);
      return roomData ? JSON.parse(roomData) : null;
    } catch (error) {
      console.error("Error getting room:", error);
      return null;
    }
  }
}

module.exports = GameManager;
