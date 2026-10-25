
import { nftHandlers } from './nfts'
import { authHandlers } from './auth'
import { realtimeHandlers } from './realtime'

export const handlers = [...authHandlers, ...nftHandlers, ...realtimeHandlers]
