
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  redirect,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectRealtime } from './lib/realtime'
import { waitForMockInitialization } from './lib/mock-ready'
import { sessionToken } from './lib/session'
import { HomePage } from './routes'
import { NFTDetailPage } from './routes/nft.$nftId'
import { CartPage } from './routes/cart'
import { CheckoutPage, ReceiptPage } from './routes/checkout'
import { AccountPage, AuthPage } from './routes/auth'
import type { NFT, NFTListResponse } from './types/nft'

type HomeSearch = { q?: string; category?: string; sort?: string; page?: number; network?: string; maxPrice?: number }

function RootLayout() {
  const client = useQueryClient()
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_MOCKS !== 'true' && !import.meta.env.VITE_REALTIME_URL) return
    let active = true
    let cleanup = () => {}
    let cancelRealtimeStart = () => {}
    const realtimeIdle = new Promise<void>((resolve) => {
      if ('requestIdleCallback' in window) {
        const handle = window.requestIdleCallback(() => resolve(), { timeout: 1000 })
        cancelRealtimeStart = () => { window.cancelIdleCallback(handle); resolve() }
      } else {
        const timer = globalThis.setTimeout(resolve, 0)
        cancelRealtimeStart = () => { globalThis.clearTimeout(timer); resolve() }
      }
    })
    void realtimeIdle.then(() => active ? waitForMockInitialization() : undefined).then(() => active ? connectRealtime() : null).then((socket) => {
      if (!socket) return
      if (!active) { socket.disconnect(); return }
      const scenario = new URLSearchParams(window.location.search).get('scenario') ?? import.meta.env.VITE_MOCK_SCENARIO ?? 'default'
      const reconcile = () => { void client.invalidateQueries({ queryKey: ['nfts'] }); void client.invalidateQueries({ queryKey: ['nft'] }); void client.invalidateQueries({ queryKey: ['cart'] }); void client.invalidateQueries({ queryKey: ['orders'] }) }
      const subscribe = () => socket.emit('subscribe', { scenario, token: sessionToken() })
      const onConnect = () => { setAnnouncement('Conexão em tempo real estabelecida.'); subscribe(); reconcile() }
      const onConnectError = (error: Error) => setAnnouncement(`Conexão em tempo real falhou: ${error.message}`)
      const onNftUpdated = (event: { id: string; version: number; priceEth: string; available: number }) => {
        const apply = (current: NFT | undefined) => current && current.version < event.version ? { ...current, priceEth: event.priceEth, available: event.available, version: event.version } : current
        client.setQueryData<NFT>(['nft', event.id], apply)
        client.setQueriesData<NFTListResponse>({ queryKey: ['nfts'] }, (current) => current && ({ ...current, items: current.items.map((nft) => nft.id === event.id ? apply(nft)! : nft) }))
        client.setQueriesData<{ items: { nftId: string; quantity: number; nft: NFT }[] }>({ queryKey: ['cart'] }, (current) => current && ({ ...current, items: current.items.map((item) => item.nftId === event.id ? { ...item, nft: apply(item.nft)! } : item) }))
        setAnnouncement('Preço ou disponibilidade de um NFT mudou. Os valores foram atualizados.')
      }
      const onOrderUpdated = (event: { id: string; version: number; status: string }) => { setAnnouncement(`O pedido ${event.id} foi atualizado: ${event.status}.`); void client.invalidateQueries({ queryKey: ['orders'] }) }
      socket.on('connect', onConnect); socket.on('connect_error', onConnectError); socket.on('nft.updated', onNftUpdated); socket.on('order.updated', onOrderUpdated)
      window.addEventListener('kurio:session-change', subscribe)
      if (socket.connected) onConnect()
      cleanup = () => { window.removeEventListener('kurio:session-change', subscribe); socket.off('connect', onConnect); socket.off('connect_error', onConnectError); socket.off('nft.updated', onNftUpdated); socket.off('order.updated', onOrderUpdated); socket.disconnect() }
    }).catch(() => setAnnouncement('Conexão em tempo real indisponível. A página continuará sincronizando via API.'))
    return () => { active = false; cancelRealtimeStart(); cleanup() }
  }, [client])
  return <><div className="sr-only" role="status" aria-live="polite">{announcement}</div><Outlet /></>
}

const rootRoute = createRootRoute({
  component: RootLayout,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    q: typeof search.q === 'string' ? search.q : '',
    category: typeof search.category === 'string' ? search.category : 'all',
    sort: typeof search.sort === 'string' ? search.sort : 'newest',
    page: Number.isFinite(Number(search.page)) && Number(search.page) > 0 ? Math.floor(Number(search.page)) : 1,
    network: typeof search.network === 'string' ? search.network : 'all',
    maxPrice: Number.isFinite(Number(search.maxPrice)) && search.maxPrice !== undefined ? Number(search.maxPrice) : 12.3,
  }),
  component: HomePage,
})

function DetailRouteComponent() {
  const { nftId } = detailRoute.useParams()
  return <NFTDetailPage nftId={nftId} />
}

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: DetailRouteComponent,
})

const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: CartPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', beforeLoad: () => { if (!sessionToken()) throw redirect({ to: '/login', search: { returnTo: '/checkout' } }) }, component: CheckoutPage })
function ReceiptRouteComponent() { const { orderId } = receiptRoute.useParams(); return <ReceiptPage orderId={orderId} /> }
const receiptRoute = createRoute({ getParentRoute: () => rootRoute, path: '/receipt/$orderId', component: ReceiptRouteComponent })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', validateSearch: (search: Record<string, unknown>) => ({ returnTo: typeof search.returnTo === 'string' && search.returnTo.startsWith('/') ? search.returnTo : '/' }), component: LoginRouteComponent })
function LoginRouteComponent() { const { returnTo } = loginRoute.useSearch(); return <AuthPage mode="login" returnTo={returnTo} /> }
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', validateSearch: (search: Record<string, unknown>) => ({ returnTo: typeof search.returnTo === 'string' && search.returnTo.startsWith('/') ? search.returnTo : '/' }), component: RegisterRouteComponent })
function RegisterRouteComponent() { const { returnTo } = registerRoute.useSearch(); return <AuthPage mode="register" returnTo={returnTo} /> }
const accountRoute = createRoute({ getParentRoute: () => rootRoute, path: '/account', beforeLoad: () => { if (!sessionToken()) throw redirect({ to: '/login', search: { returnTo: '/account' } }) }, component: AccountPage })

const routeTree = rootRoute.addChildren([
  homeRoute,
  detailRoute, cartRoute, checkoutRoute, receiptRoute, loginRoute, registerRoute, accountRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <RouterProvider router={router} />
}
