# Fast Tap Backend API Documentation

## Base URL
```
http://localhost:5000
```

## REST API Endpoints

### Health Check
```
GET /health
```
Returns server status and storage information.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-06T15:30:45.123Z",
  "storage": "in-memory",
  "note": "Redis not connected - using in-memory storage for development"
}
```

### Get All Rooms
```
GET /api/rooms
```
Returns list of all active game rooms.

**Response:**
```json
[
  {
    "id": "ABCD1234",
    "playerCount": 2,
    "maxPlayers": 10,
    "status": "waiting",
    "createdAt": 1696606245123
  }
]
```

## Socket.IO Events

### Connection
When a client connects to the Socket.IO server:
```javascript
const socket = io('http://localhost:5000');
```

### Client → Server Events

#### Create Room
```javascript
socket.emit('createRoom', { 
  playerName: 'Player1' 
});
```

#### Join Room
```javascript
socket.emit('joinRoom', { 
  roomId: 'ABCD1234', 
  playerName: 'Player1' 
});
```

#### Start Game (Host Only)
```javascript
socket.emit('startGame', { 
  roomId: 'ABCD1234' 
});
```

#### Register Tap
```javascript
socket.emit('tap', { 
  roomId: 'ABCD1234' 
});
```

#### Leave Room
```javascript
socket.emit('leaveRoom', { 
  roomId: 'ABCD1234' 
});
```

### Server → Client Events

#### Room Created Successfully
```javascript
socket.on('roomCreated', (data) => {
  // data: { roomId, playerId, playerName, room }
});
```

#### Joined Room Successfully
```javascript
socket.on('joinedRoom', (data) => {
  // data: { roomId, playerId, playerName, room }
});
```

#### Player Joined Room
```javascript
socket.on('playerJoined', (data) => {
  // data: { playerId, playerName, room }
});
```

#### Player Left Room
```javascript
socket.on('playerLeft', (data) => {
  // data: { playerId, room }
});
```

#### Game Started
```javascript
socket.on('gameStarted', (data) => {
  // data: { gameState, startTime }
});
```

#### Tap Registered
```javascript
socket.on('tapRegistered', (data) => {
  // data: { playerId, tapCount, leaderboard }
});
```

#### Game Ended
```javascript
socket.on('gameEnded', (data) => {
  // data: { results, winner }
});
```

#### Error Events
```javascript
socket.on('joinRoomError', (data) => {
  // data: { message }
});

socket.on('createRoomError', (data) => {
  // data: { message }
});

socket.on('startGameError', (data) => {
  // data: { message }
});
```

## Data Structures

### Room Object
```json
{
  "id": "ABCD1234",
  "host": "socket-id-123",
  "players": {
    "socket-id-123": {
      "id": "socket-id-123",
      "name": "Player1",
      "tapCount": 42,
      "isReady": false
    }
  },
  "status": "waiting",
  "createdAt": 1696606245123,
  "maxPlayers": 10,
  "gameStartTime": 1696606300000,
  "gameEndTime": 1696606330000
}
```

### Game State Object
```json
{
  "roomId": "ABCD1234",
  "status": "playing",
  "players": {
    "socket-id-123": {
      "id": "socket-id-123",
      "name": "Player1",
      "tapCount": 42,
      "isReady": false
    }
  },
  "startTime": 1696606300000,
  "duration": 30000
}
```

### Leaderboard Array
```json
[
  {
    "rank": 1,
    "playerId": "socket-id-123",
    "playerName": "Player1",
    "tapCount": 156
  },
  {
    "rank": 2,
    "playerId": "socket-id-456",
    "playerName": "Player2",
    "tapCount": 142
  }
]
```

## Game Flow

1. **Create/Join Room**: Player creates a new room or joins existing one
2. **Wait for Players**: Host waits for other players to join
3. **Start Game**: Host starts the game (30-second timer begins)
4. **Gameplay**: Players tap as fast as possible
5. **Real-time Updates**: Tap counts and leaderboard update in real-time
6. **Game End**: Game automatically ends after 30 seconds
7. **Results**: Final leaderboard and winner are displayed

## Configuration

Environment variables can be set in the `.env` file:

- `PORT`: Server port (default: 5000)
- `CORS_ORIGIN`: Allowed frontend origin (default: http://localhost:3000)
- `GAME_DURATION`: Game duration in milliseconds (default: 30000)
- `MAX_PLAYERS_PER_ROOM`: Maximum players per room (default: 10)

## Testing

Use a tool like [Socket.IO Client Tool](https://socket.io/docs/v4/client-api/) or create a simple HTML page to test the Socket.IO events.