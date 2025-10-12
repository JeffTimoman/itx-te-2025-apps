// Socket handlers extracted from server.js
const log = require('./log');

module.exports = function registerSocketHandlers(io, gameManager) {
  io.on('connection', (socket) => {
    log.info('New client connected:', socket.id);

    // Join room
    socket.on('joinRoom', async (data) => {
      try {
        const { roomId, playerName } = data;
        const result = await gameManager.joinRoom(socket.id, roomId, playerName);
        if (result.success) {
          socket.join(roomId);
          socket.emit('joinedRoom', { roomId, playerId: socket.id, playerName, room: result.room });
          socket.to(roomId).emit('playerJoined', { playerId: socket.id, playerName, room: result.room });
          try {
            const gameState = await gameManager.getGameState(roomId);
            if (gameState && gameState.status === 'playing') {
              socket.emit('gameStarted', { gameState, startTime: gameState.startTime, durationMs: gameState.duration, isMidJoin: true });
            }
          } catch (e) {
            log.warn('Failed to send gameState to joining client', e && e.message);
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
          socket.emit('roomCreated', { roomId: result.roomId, playerId: socket.id, playerName, room: result.room });
        } else {
          socket.emit('createRoomError', { message: result.message });
        }
      } catch (error) {
        log.error('Error creating room:', error);
        socket.emit('createRoomError', { message: 'Failed to create room' });
      }
    });

    // Start game
    socket.on('startGame', async (data) => {
      try {
        const { roomId } = data;
        const duration = Number(data.duration) || 30; // seconds
  log.info(`startGame requested by ${socket.id} for room ${roomId} durationSeconds=${duration}`);
  const result = await gameManager.startGame(roomId, socket.id, duration);
  log.debug('startGame result:', result && result.success ? 'success' : 'failed', result && result.gameState ? { duration: result.gameState.duration, startTime: result.gameState.startTime } : result);

        if (result.success) {
          try { console.log(`Starting game ${roomId} durationMs=${result.gameState.duration}`); } catch(e) {}
          io.to(roomId).emit('gameStarted', { gameState: result.gameState, startTime: result.gameState.startTime, durationMs: result.gameState.duration, durationSeconds: Math.round((result.gameState.duration || 0) / 1000) });

          const durationMs = result.gameState.duration || 30000;
          const timer = setTimeout(async () => {
            const room = await gameManager.getRoom(roomId);
            if (!room) return;
            if (room.firstTap) {
              const endResult = await gameManager.endGame(roomId);
              if (endResult.success) {
                io.to(roomId).emit('gameEnded', { results: endResult.results, winner: endResult.winner });
              }
            } else {
              io.to(roomId).emit('timeExpiredNoTap', { message: 'Time expired with no taps' });
              try {
                room.status = 'post';
                await gameManager._setEx(`${gameManager.ROOM_PREFIX}${roomId}`, 3600, JSON.stringify(room));
                io.to(roomId).emit('postTimerOpen', { message: 'Timer ended — first tap now wins' });
              } catch (e) {
                log.warn('Failed to set room to post state after empty timeout', e && e.message);
              }
            }
          }, durationMs);

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
          if (result.firstTapRecorded) {
            if (global._gameTimers && global._gameTimers[roomId]) {
              clearTimeout(global._gameTimers[roomId]);
              delete global._gameTimers[roomId];
            }

            io.to(roomId).emit('firstTap', { playerId: result.tap.playerId, playerName: result.tap.playerName, timestamp: result.tap.timestamp });
            io.to(roomId).emit('disableTaps', { message: 'First tap received' });

            const TIE_WINDOW_MS = 150;
            setTimeout(async () => {
              try {
                const endResult = await gameManager.endGame(roomId);
                if (endResult.success) {
                  io.to(roomId).emit('gameEnded', { results: endResult.results, winner: endResult.winner });
                }
              } catch (e) {
                log.warn('Error finalizing endGame after tie window', e && e.message);
              }
            }, TIE_WINDOW_MS);
          }
          io.to(roomId).emit('tapRegistered', { playerId: socket.id });
        } else {
          try { socket.emit('tapDenied', { message: result.message }); } catch (e) {}
        }
          } catch (error) {
        log.error('Error registering tap:', error);
      }
    });

    // setAllowJoins
    socket.on('setAllowJoins', async (data) => {
      try {
        const { roomId, allow } = data;
        const room = await gameManager.getRoom(roomId);
        if (!room) return;
        if (room.host !== socket.id) {
          socket.emit('setAllowJoinsError', { message: 'Only the host can change join settings' });
          return;
        }
        room.allowJoins = !!allow;
        await gameManager._setEx(`${gameManager.ROOM_PREFIX}${roomId}`, 3600, JSON.stringify(room));
        io.to(roomId).emit('allowJoinsChanged', { allowJoins: room.allowJoins, room });
        socket.emit('setAllowJoinsAck', { success: true });
      } catch (e) {
        log.error('Error setting allowJoins', e && e.message);
        socket.emit('setAllowJoinsError', { message: 'Failed to set allowJoins' });
      }
    });

    // resetRound
    socket.on('resetRound', async (data) => {
      try {
        const { roomId } = data;
        const room = await gameManager.getRoom(roomId);
        if (!room) return;
        delete room.firstTap;
        delete room.awaitingAnswer;
        room.status = 'waiting';
        delete room.taps;
        delete room.lastWinner;
        delete room.roundWinners;
        delete room.gameStartTime;
        delete room.gameDuration;
        await gameManager._setEx(`${gameManager.ROOM_PREFIX}${roomId}`, 3600, JSON.stringify(room));
        io.to(roomId).emit('roundReset', { message: 'Round has been reset by admin', room });
      } catch (err) {
        log.error('Error resetting round', err);
      }
    });

    // endGame
    socket.on('endGame', async (data) => {
      try {
        const { roomId } = data;
        const room = await gameManager.getRoom(roomId);
        if (!room) {
          socket.emit('endGameError', { message: 'Room not found' });
          return;
        }
        if (room.host !== socket.id) {
          socket.emit('endGameError', { message: 'Only the host can end the game' });
          return;
        }
        const playerIds = Object.keys(room.players || {});
        for (const pid of playerIds) {
          if (pid === socket.id) continue;
          try { await gameManager.leaveRoom(roomId, pid); } catch (e) {}
          try {
            const playerSocket = io.sockets.sockets.get(pid);
            if (playerSocket) {
              try { playerSocket.emit('kicked', { message: 'The admin ended the game' }); } catch (e) {}
              try { playerSocket.leave(roomId); } catch (e) {}
              try { playerSocket.disconnect(true); } catch (e) {}
            }
          } catch (e) {}
        }
        const updated = await gameManager.getRoom(roomId);
        io.to(roomId).emit('roomEnded', { message: 'Game ended by admin', room: updated });
        socket.emit('endGameAck', { success: true });
      } catch (err) {
        log.error('Error ending game', err);
        socket.emit('endGameError', { message: 'Failed to end game' });
      }
    });

    // leaveRoom
    socket.on('leaveRoom', async (data) => {
      try {
        const { roomId } = data;
        const result = await gameManager.leaveRoom(roomId, socket.id);
        if (result.success) {
          socket.leave(roomId);
          socket.to(roomId).emit('playerLeft', { playerId: socket.id, room: result.room });
        }
      } catch (error) {
        log.error('Error leaving room:', error);
      }
    });

    // disconnect
    socket.on('disconnect', async () => {
      log.info('Client disconnected:', socket.id);
      try {
        const result = await gameManager.handleDisconnect(socket.id);
        if (result && result.success && result.room) {
          const roomId = result.room.id || result.roomId;
          try { io.to(roomId).emit('playerLeft', { playerId: socket.id, room: result.room }); } catch (e) {}
        }
      } catch (error) {
        log.error('Error handling disconnect:', error);
      }
    });
  });
};
