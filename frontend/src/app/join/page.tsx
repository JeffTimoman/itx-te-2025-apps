'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';

type PlayerResult = { playerId: string; playerName: string; tapCount: number };
type FirstTapEvent = { playerId: string; playerName: string; timestamp: number };
type GameEndedEvent = { results?: PlayerResult[]; winner?: PlayerResult };

export default function JoinPage() {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState('');
  const [winner, setWinner] = useState<PlayerResult | null>(null);
  const [bgGreen, setBgGreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [tapDisabled, setTapDisabled] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PlayerResult[]>([]);
  const timerRef = useRef<number | null>(null);
  const [isMidJoin, setIsMidJoin] = useState(false);
  const inactivityRef = useRef<number | null>(null);
  const INACTIVITY_SECONDS = 60; // seconds before auto-return to join

  useEffect(() => {
    const socket = getSocket();

    socket.on('joinedRoom', (data: { roomId: string; playerName: string }) => {
      setJoined(true);
      setMessage(`Joined room ${data.roomId} as ${data.playerName}`);
      // start or reset inactivity timer when joined
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
      inactivityRef.current = window.setTimeout(() => {
        // auto-leave due to inactivity
        try { socket.emit('leaveRoom', { roomId: roomId.toUpperCase() }); } catch { }
        setJoined(false);
        setMessage('You were inactive and returned to join screen');
        setTapDisabled(true);
      }, INACTIVITY_SECONDS * 1000);
    });

    socket.on('joinRoomError', (err: { message?: string }) => {
      setMessage(err.message || 'Failed to join');
    });

    socket.on('gameStarted', (data: { gameState?: { duration?: number }; startTime?: number; durationMs?: number; isMidJoin?: boolean }) => {
      console.log('gameStarted payload', data);
      setMessage('Game started!');
      setBgGreen(false);
      setTapDisabled(false);
      if (data.isMidJoin) {
        setIsMidJoin(true);
        // mid-joiners cannot tap until next round
        setTapDisabled(true);
      } else {
        setIsMidJoin(false);
      }
      setLeaderboard([]);
      // data.gameState.duration is ms
      const totalMs = data.durationMs ?? data.gameState?.duration ?? 30000;
      // data.startTime is authoritative server startTime (ms since epoch)
      const serverStart = data.startTime ?? Date.now();
      if (totalMs) {
        const endTs = serverStart + totalMs;
        // clear any existing interval first
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const tick = () => {
          const left = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
          setTimeLeft(left);
          if (left <= 0) {
            setTimeLeft(0);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        };
        tick();
        timerRef.current = window.setInterval(tick, 250);
      }
    });

    socket.on('firstTap', (data: FirstTapEvent) => {
      setWinner({ playerId: data.playerId, playerName: data.playerName, tapCount: 1 });
      if (data.playerName === name) setBgGreen(true);
      setTapDisabled(true);
      // clear inactivity timer while round ended
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
    });

    // When server says disable taps (first tap), ensure button is disabled
    socket.on('disableTaps', () => {
      setTapDisabled(true);
    });

    // If time expired and no taps were received, server indicates participants may still press
    socket.on('timeExpiredNoTap', () => {
      setMessage('Time expired with no taps — TAPS ARE STILL ALLOWED');
      // allow taps per your request
      setTapDisabled(false);
      setTimeLeft(0);
    });

    // When admin resets the round
    socket.on('roundReset', (data: { message?: string }) => {
      setMessage(data?.message || 'Round reset by admin');
      setWinner(null);
      setBgGreen(false);
      setLeaderboard([]);
      setTapDisabled(false);
      setIsMidJoin(false);
      setTimeLeft(null);
      // restart inactivity timer
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
      inactivityRef.current = window.setTimeout(() => {
        try { socket.emit('leaveRoom', { roomId: roomId.toUpperCase() }); } catch { }
        setJoined(false);
        setMessage('You were inactive and returned to join screen');
        setTapDisabled(true);
      }, INACTIVITY_SECONDS * 1000);
    });

    socket.on('gameEnded', (data: GameEndedEvent) => {
      setMessage(`Game ended. Winner: ${data.winner?.playerName || 'N/A'}`);
      setWinner(data.winner || null);
      setTapDisabled(true);
      if (data.results) setLeaderboard(data.results);
      // clear inactivity as round ended
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
    });

    socket.on('disconnect', () => {
      setJoined(false);
      setMessage('Disconnected from server — please re-join');
      setTapDisabled(true);
    });

    // Activity tracking to reset inactivity timer
    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'click'];
    const resetInactivity = () => {
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
      if (joined) {
        inactivityRef.current = window.setTimeout(() => {
          try { socket.emit('leaveRoom', { roomId: roomId.toUpperCase() }); } catch (e) {}
          setJoined(false);
          setMessage('You were inactive and returned to join screen');
          setTapDisabled(true);
        }, INACTIVITY_SECONDS * 1000);
      }
    };
    activityEvents.forEach(ev => window.addEventListener(ev, resetInactivity));

    const beforeUnloadHandler = () => {
      try { socket.emit('leaveRoom', { roomId: roomId.toUpperCase() }); } catch { }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    return () => {
      socket.off('joinedRoom');
      socket.off('joinRoomError');
      socket.off('gameStarted');
      socket.off('firstTap');
      socket.off('disableTaps');
      socket.off('timeExpiredNoTap');
      socket.off('roundReset');
      socket.off('gameEnded');
      socket.off('disconnect');
      activityEvents.forEach(ev => window.removeEventListener(ev, resetInactivity));
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [name, joined, roomId]);

  function handleJoin() {
    if (!roomId || !name) {
      setMessage('Please enter room and name');
      return;
    }
    const socket = getSocket();
    socket.emit('joinRoom', { roomId: roomId.toUpperCase(), playerName: name });
  }

  function handleTap() {
    const socket = getSocket();
    if (tapDisabled) return;
    socket.emit('tap', { roomId: roomId.toUpperCase() });
    // disable button locally to avoid double taps
    setTapDisabled(true);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-4">Join Fast Tap</h1>
      {!joined ? (
        <div className="flex flex-col gap-2 w-full max-w-md">
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter game code" className="p-2 border rounded" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name (unique)" className="p-2 border rounded" />
          <button onClick={handleJoin} className="bg-blue-600 text-white p-2 rounded">Join</button>
          {message && <div className="mt-2 text-sm text-gray-700">{message}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-4 items-center">
          {isMidJoin && (
            <div className="mb-2 px-3 py-1 bg-yellow-300 text-black rounded">Joined mid-round (you cannot tap until next round)</div>
          )}
            <div className={`w-64 h-32 rounded flex items-center justify-center text-xl font-bold ${bgGreen ? 'bg-green-500' : 'bg-gray-200'}`}>
              {bgGreen ? 'You clicked first!' : (timeLeft !== null ? `Time left: ${timeLeft}s` : 'Waiting...') }
            </div>
            <button disabled={tapDisabled} onClick={handleTap} className={`text-white p-4 rounded text-xl ${tapDisabled ? 'bg-gray-400' : 'bg-red-600'}`}>
              TAP
            </button>
            {winner && <div className="mt-2">Winner: {winner.playerName}</div>}
            {leaderboard.length > 0 && (
              <div className="mt-4 w-64">
                <h4 className="font-bold">Leaderboard</h4>
                <ol className="list-decimal list-inside">
                  {leaderboard.map((r) => (
                    <li key={r.playerId}>{r.playerName} — {r.tapCount}</li>
                  ))}
                </ol>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
