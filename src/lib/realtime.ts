import type { Socket } from 'socket.io-client'

let socketPromise: Promise<Socket> | undefined

export function connectRealtime(): Promise<Socket> {
  socketPromise ??= import('socket.io-client').then(({ io }) => io({ path: '/socket.io/', transports: ['websocket'], reconnection: true, reconnectionDelay: 500 }))
  return socketPromise
}

export function disconnectRealtime() {
  void socketPromise?.then((socket) => socket.disconnect())
  socketPromise = undefined
}
