'use client';

import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: true
    });
  }
  return socket;
}
