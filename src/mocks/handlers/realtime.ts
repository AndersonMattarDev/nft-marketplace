import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { nfts } from '../fixtures/nfts'
import { getMockUserId } from './auth'

const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
// Socket.IO appends EIO/transport query parameters and normalizes its path;
// match the local origin wildcard so both its slash variants are intercepted.
const realtime = ws.link(`${scheme}//${location.host}/*`)
const connectedClients = new Map<ReturnType<typeof toSocketIo>['client'], string | null>()

export function emitMockSocketEvent(event: string, payload: unknown, owner?: string) {
  connectedClients.forEach((clientOwner, client) => {
    if (owner === undefined || clientOwner === owner) client.emit(event, payload)
  })
}

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const { client } = toSocketIo(connection)
    connectedClients.set(client, null)
    let timer: ReturnType<typeof setTimeout> | undefined
    client.on('subscribe', (_event, input: { scenario?: string; token?: string | null }) => {
      const userId = input?.token ? getMockUserId(input.token) : undefined
      connectedClients.set(client, input?.token ? (userId ? `user:${userId}` : null) : 'guest')
      if (input?.scenario !== 'price-change' || timer) return
      timer = setTimeout(() => {
        const nft = nfts[0]
        nft.priceEth = (Number(nft.priceEth) + 0.1).toFixed(2)
        nft.available = Math.max(0, nft.available - 1)
        nft.version += 1
        client.emit('nft.updated', { id: nft.id, resource: 'nft', version: nft.version, priceEth: nft.priceEth, available: nft.available })
      }, 1800)
    })
    connection.server.addEventListener('close', () => { connectedClients.delete(client); if (timer) clearTimeout(timer) })
  }),
]
