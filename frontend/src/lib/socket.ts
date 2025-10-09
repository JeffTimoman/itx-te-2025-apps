'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    // If base is empty, io() will connect to the same origin which served the page.
    socket = io(base || undefined, {
      autoConnect: true
    });
  }
  return socket;
}
