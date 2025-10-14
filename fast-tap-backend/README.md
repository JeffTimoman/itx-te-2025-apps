# Fast Tap Backend

A Node.js backend server for the Fast Tap game using Socket.IO and Redis.

## Features

- Real-time multiplayer game using Socket.IO
- Redis for state management and persistence
- Room-based gameplay
- Player management and leaderboards
- RESTful API endpoints
- Environment configuration

## Prerequisites

- Node.js (v14 or higher)
- Redis server

## Installation

1. Navigate to the backend directory:
   ```bash
   cd fast-tap-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env` file and adjust settings if needed
   - Make sure Redis is running on your system

## Running the Server

### Development (without Redis - for testing)
```bash
npm run dev
```
This uses in-memory storage and is perfect for development and testing.

### Development (with Redis)
```bash
npm run dev:redis
```
Use this when Redis is installed and running.

### Production
```bash
npm start
```
Requires Redis to be installed and running.

The server will start on port 5000 by default.

## Quick Start (No Redis Required)

The backend is ready to run immediately without Redis:

1. Navigate to the backend directory:
   ```bash
   cd fast-tap-backend
   ```

2. Install dependencies (already done):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The server will be available at `http://localhost:5000`

5. Test the health endpoint: `GET http://localhost:5000/health`

## API Endpoints

### Health Check
- `GET /health` - Returns server status and Redis connection status

### Rooms
- `GET /api/rooms` - Get all active rooms

## Socket.IO Events

### Client to Server Events

- `createRoom` - Create a new game room
  ```js
  socket.emit('createRoom', { playerName: 'Player1' });
  ```

- `joinRoom` - Join an existing room
  ```js
  socket.emit('joinRoom', { roomId: 'ABCD1234', playerName: 'Player1' });
  ```

- `startGame` - Start the game (host only)
  ```js
  socket.emit('startGame', { roomId: 'ABCD1234' });
  ```

- `tap` - Register a tap during gameplay
  ```js
  socket.emit('tap', { roomId: 'ABCD1234' });
  ```

- `leaveRoom` - Leave the current room
  ```js
  socket.emit('leaveRoom', { roomId: 'ABCD1234' });
  ```

### Server to Client Events

- `roomCreated` - Room successfully created
- `joinedRoom` - Successfully joined a room
- `playerJoined` - Another player joined the room
- `playerLeft` - A player left the room
- `gameStarted` - Game has started
- `gameEnded` - Game has ended with results
- `tapRegistered` - A tap was registered with updated leaderboard
- Various error events for failed operations

## Environment Variables

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `REDIS_URL` - Redis connection URL
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (if required)
- `CORS_ORIGIN` - Allowed CORS origin (default: http://localhost:3000)
- `GAME_DURATION` - Game duration in milliseconds (default: 30000)
- `MAX_PLAYERS_PER_ROOM` - Maximum players per room (default: 10)

### Authentication (JWT)

- `JWT_SECRET` - Secret used to sign JWTs for admin auth (recommended to set in production).
- `JWT_EXPIRES_IN` - Token expiry (e.g. '24h', '1d', '3600s'). Defaults to 24h.

## Redis Setup

### Windows (using Chocolatey)
```bash
choco install redis-64
redis-server
```

### Using Docker
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

## Project Structure

```
fast-tap-backend/
├── src/
│   └── gameManager.js    # Game logic and room management
├── server.js             # Main server file
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables
└── README.md             # This file
```

## Game Flow

1. Player creates or joins a room
2. Host starts the game when ready
3. Players tap as fast as possible during the game duration
4. Real-time leaderboard updates
5. Game ends automatically after the duration
6. Final results are displayed

## Error Handling

The server includes comprehensive error handling for:
- Redis connection issues
- Invalid room operations
- Player state management
- Socket connection problems

## Development

To contribute or modify:

1. Make sure Redis is running
2. Use `npm run dev` for development with auto-restart
3. Check logs for any errors
4. Test Socket.IO events using a client application

## Troubleshooting

1. **Redis connection failed**: Make sure Redis server is running
2. **CORS errors**: Check the `CORS_ORIGIN` environment variable
3. **Port already in use**: Change the `PORT` environment variable
4. **Socket connection issues**: Verify the frontend is connecting to the correct backend URL