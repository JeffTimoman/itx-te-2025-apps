'use client';

import React, { useEffect, useState } from 'react';

type Player = { id: string; name: string };
type Room = { id: string; players: Record<string, Player>; host?: string };
import { getSocket } from '../../lib/socket';

export default function AdminPage() {
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState('');
  const [firstTap, setFirstTap] = useState<{playerId:string, playerName:string} | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('roomCreated', (data: { roomId: string; room: Room }) => {
      setCreatedRoom(data.room);
      // show players excluding the host/admin
      const room = data.room;
      const playersList = room && room.players ? Object.values(room.players).filter(p => p.id !== room.host) : [];
      setPlayers(playersList);
      setMessage(`Room ${data.roomId} created`);
    });
    socket.on('playerJoined', (data: { playerName: string; room?: Room }) => {
      // room object may be included
      setMessage(`${data.playerName} joined`);
      const room = data.room;
      if (room && room.players) {
        const playersList = Object.values(room.players).filter(p => p.id !== room.host);
        setPlayers(playersList);
      }
    });
    socket.on('playerLeft', (data: { room?: Room }) => {
      const room = data.room;
      if (room && room.players) {
        const playersList = Object.values(room.players).filter(p => p.id !== room.host);
        setPlayers(playersList);
      }
    });

    socket.on('gameStarted', () => {
      setMessage('Game started');
    });

    socket.on('firstTap', (data: { playerId: string; playerName: string }) => {
      setMessage(`${data.playerName} clicked first!`);
      setFirstTap({ playerId: data.playerId, playerName: data.playerName });
    });

    socket.on('gameEnded', (data: { winner?: { playerName?: string } }) => {
      setMessage(`Game ended. Winner: ${data.winner?.playerName || 'N/A'}`);
    });

    socket.on('roundReset', (data:{ message?: string; room?: Room }) => {
      setMessage(data.message || 'Round reset');
      setFirstTap(null);
      const room = data.room;
      if (room && room.players) {
        const playersList = Object.values(room.players).filter(p => p.id !== room.host);
        setPlayers(playersList);
      }
    });

    socket.on('roomEnded', (data: { message?: string; room?: Room }) => {
      setMessage(data.message || 'Room ended');
      setFirstTap(null);
      // room may be cleared or updated
      const room = data.room;
      if (!room || !room.players) {
        setPlayers([]);
        setCreatedRoom(null);
      } else {
        const playersList = Object.values(room.players).filter(p => p.id !== room.host);
        setPlayers(playersList);
      }
    });

    socket.on('endGameAck', () => {
      setMessage('Game ended');
    });

    socket.on('endGameError', (err: { message?: string }) => {
      setMessage(err.message || 'Failed to end game');
    });

    return () => {
      socket.off('roomCreated');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('gameStarted');
      socket.off('firstTap');
      socket.off('gameEnded');
      socket.off('roomEnded');
      socket.off('endGameAck');
      socket.off('endGameError');
    };
  }, []);

  function handleCreate() {
    if (!name) {
      setMessage('Enter your name');
      return;
    }
    const socket = getSocket();
    socket.emit('createRoom', { playerName: name });
  }

  function handleStart(durationSeconds: number) {
    if (!createdRoom) {
      setMessage('Create a room first');
      return;
    }
    const socket = getSocket();
    console.log('Admin starting game', { roomId: createdRoom.id, duration: durationSeconds });
    socket.emit('startGame', { roomId: createdRoom.id, duration: durationSeconds });
  }

  function handleReset() {
    if (!createdRoom) return;
    const socket = getSocket();
    socket.emit('resetRound', { roomId: createdRoom.id });
  }

  function handleEnd() {
    if (!createdRoom) return;
    const socket = getSocket();
    socket.emit('endGame', { roomId: createdRoom.id });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-4">Admin - Fast Tap</h1>
      {!createdRoom ? (
        <div className="flex flex-col gap-2 w-full max-w-md">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (host)" className="p-2 border rounded" />
          <button onClick={handleCreate} className="bg-green-600 text-white p-2 rounded">Create Room</button>
          {message && <div className="mt-2 text-sm text-gray-700">{message}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-4 items-center">
          <div>Room Code: <span className="font-mono text-lg">{createdRoom.id}</span></div>
          <div className="flex gap-2">
            {[1,2,5,10,15,20,25,30].map((s) => (
              <button key={s} onClick={() => handleStart(s)} className="px-3 py-1 bg-blue-600 text-white rounded">{s}s</button>
            ))}
          </div>
          <div className="mt-2">
            <button onClick={handleReset} className="px-3 py-1 bg-yellow-500 text-black rounded">Reset Round</button>
            <button onClick={() => handleEnd()} className="ml-2 px-3 py-1 bg-red-600 text-white rounded">End Game</button>
          </div>
          <div className="mt-4">
            <h3>Players</h3>
            <ul>
              {players.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </div>
          {firstTap && (
            <div className="mt-2">First taper: <strong>{firstTap.playerName}</strong></div>
          )}
          {message && <div className="mt-2">{message}</div>}
        </div>
      )}
    </div>
  );
}
