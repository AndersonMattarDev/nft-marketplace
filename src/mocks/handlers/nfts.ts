
import { http, HttpResponse, delay } from 'msw'
import { nfts } from '../fixtures/nfts'
import { getMockUserId, getSimulatedWalletBalance, setSimulatedWalletBalance } from './auth'
import { emitMockSocketEvent } from './realtime'

type CartItem = { nftId: string; quantity: number }
type OrderItem = CartItem & { name: string; collection: string; priceEth: string; version: number }
type Order = { id: string; status: 'pending' | 'confirmed' | 'declined'; createdAt: string; items: OrderItem[]; subtotalEth: string; discountEth: string; couponCode: string; networkFeeEth: string; totalEth: string; walletAddress: string; network: string; version: number }
type StoredOrder = { owner: string; key: string; signature: string; order: Order }
type CartStore = Record<string, CartItem[]>
const cartsStorageKey = 'kurio-carts'
const ordersStorageKey = 'kurio-orders'
const favoritesStorageKey = 'kurio-favorites'
const couponsStorageKey = 'kurio-cart-coupons'

function readCarts(): CartStore {
  const saved = localStorage.getItem(cartsStorageKey)
  if (saved) return JSON.parse(saved) as CartStore

  // Migrate existing single-cart installs as a visitor cart, then scope future
  // cart changes to the authenticated user returned by the mock session.
  const legacyCart = JSON.parse(localStorage.getItem('kurio-cart') ?? '[]') as CartItem[]
  const carts: CartStore = legacyCart.length ? { guest: legacyCart } : {}
  localStorage.setItem(cartsStorageKey, JSON.stringify(carts))
  localStorage.removeItem('kurio-cart')
  return carts
}

const saveCarts = (carts: CartStore) => localStorage.setItem(cartsStorageKey, JSON.stringify(carts))

function ownerForRequest(request: Request): string | null {
  const authorization = request.headers.get('Authorization')
  if (!authorization) return 'guest'
  const token = authorization.replace(/^Bearer\s+/, '')
  const userId = token ? getMockUserId(token) : undefined
  return userId ? `user:${userId}` : null
}

function cartForRequest(request: Request) {
  const owner = ownerForRequest(request)
  if (!owner) return null
  const carts = readCarts()
  const cart = carts[owner] ?? []

  // Preserve a visitor's cart on the first authenticated request without
  // carrying one account's private cart into another account.
  if (owner !== 'guest' && carts.guest?.length) {
    for (const guestItem of carts.guest) {
      const nft = nfts.find((item) => item.id === guestItem.nftId)
      if (!nft) continue
      const existing = cart.find((item) => item.nftId === guestItem.nftId)
      if (existing) existing.quantity = Math.min(nft.available, existing.quantity + guestItem.quantity)
      else cart.push({ ...guestItem, quantity: Math.min(nft.available, guestItem.quantity) })
    }
    carts[owner] = cart
    carts.guest = []
    saveCarts(carts)
  }

  if (owner !== 'guest') {
    const coupons = readCoupons()
    if (!coupons[owner] && coupons.guest) coupons[owner] = coupons.guest
    delete coupons.guest
    saveCoupons(coupons)
  }

  carts[owner] = cart
  return { owner, carts, items: cart }
}

function readOrders(): StoredOrder[] {
  return JSON.parse(localStorage.getItem(ordersStorageKey) ?? '[]') as StoredOrder[]
}

const saveOrders = (orders: StoredOrder[]) => localStorage.setItem(ordersStorageKey, JSON.stringify(orders))
type FavoritesStore = Record<string, string[]>
const readFavorites = (): FavoritesStore => JSON.parse(localStorage.getItem(favoritesStorageKey) ?? '{}') as FavoritesStore
const saveFavorites = (favorites: FavoritesStore) => localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites))
type CouponStore = Record<string, string>
const readCoupons = (): CouponStore => JSON.parse(localStorage.getItem(couponsStorageKey) ?? '{}') as CouponStore
const saveCoupons = (coupons: CouponStore) => localStorage.setItem(couponsStorageKey, JSON.stringify(coupons))

function couponDiscount(code: string, subtotal: number) {
  if (code === 'KURIO10') return { code, discountEth: (subtotal * 0.1).toFixed(2), description: '10% de desconto' }
  if (code === 'EXPIRED10') return null
  return null
}

export const nftHandlers = [
  http.get('/api/favorites', ({ request }) => {
    const owner = ownerForRequest(request)
    if (!owner || owner === 'guest') return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
    return HttpResponse.json({ items: readFavorites()[owner] ?? [] })
  }),
  http.post('/api/favorites/:id', ({ params, request }) => {
    const owner = ownerForRequest(request)
    if (!owner || owner === 'guest') return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
    if (request.headers.get('X-Mock-Scenario') === 'favorite-failure') return HttpResponse.json({ code: 'FAVORITE_FAILURE', message: 'Falha simulada ao salvar o favorito.' }, { status: 503 })
    if (!nfts.some((nft) => nft.id === params.id)) return HttpResponse.json({ code: 'NFT_NOT_FOUND' }, { status: 404 })
    const favorites = readFavorites(); const own = new Set(favorites[owner] ?? []); own.add(String(params.id)); favorites[owner] = [...own]; saveFavorites(favorites)
    return HttpResponse.json({ items: favorites[owner] }, { status: 201 })
  }),
  http.delete('/api/favorites/:id', ({ params, request }) => {
    const owner = ownerForRequest(request)
    if (!owner || owner === 'guest') return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
    const favorites = readFavorites(); favorites[owner] = (favorites[owner] ?? []).filter((id) => id !== params.id); saveFavorites(favorites)
    return HttpResponse.json({ items: favorites[owner] })
  }),
  http.post('/api/coupons/validate', async ({ request }) => {
    const body = await request.json() as { code: string; subtotalEth: string }
    const code = body.code.trim().toUpperCase()
    if (code === 'EXPIRED10') return HttpResponse.json({ code: 'COUPON_EXPIRED', message: 'Este cupom expirou.' }, { status: 410 })
    const discount = couponDiscount(code, Number(body.subtotalEth))
    if (!discount) return HttpResponse.json({ code: 'COUPON_INVALID', message: 'Cupom inválido. Confira o código e tente novamente.' }, { status: 422 })
    return HttpResponse.json(discount)
  }),
  http.post('/api/cart/coupon', async ({ request }) => {
    const state = cartForRequest(request)
    if (!state) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as { code?: string }
    const coupons = readCoupons(); const code = body.code?.trim().toUpperCase() ?? ''
    if (!code) { delete coupons[state.owner]; saveCoupons(coupons); return HttpResponse.json({ couponCode: '', discountEth: '0.00' }) }
    if (code === 'EXPIRED10') return HttpResponse.json({ code: 'COUPON_EXPIRED', message: 'Este cupom expirou.' }, { status: 410 })
    const subtotal = state.items.reduce((sum, item) => sum + Number(nfts.find((nft) => nft.id === item.nftId)?.priceEth ?? 0) * item.quantity, 0)
    const discount = couponDiscount(code, subtotal)
    if (!discount) return HttpResponse.json({ code: 'COUPON_INVALID', message: 'Cupom inválido. Confira o código e tente novamente.' }, { status: 422 })
    coupons[state.owner] = code; saveCoupons(coupons)
    return HttpResponse.json({ couponCode: code, discountEth: discount.discountEth })
  }),
  http.get('/api/cart', ({ request }) => {
    const state = cartForRequest(request)
    if (!state) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const items = state.items.map((item) => ({ ...item, nft: nfts.find((nft) => nft.id === item.nftId) })).filter((item) => item.nft)
    const subtotal = state.items.reduce((sum, item) => sum + Number(nfts.find((nft) => nft.id === item.nftId)?.priceEth ?? 0) * item.quantity, 0)
    const couponCode = readCoupons()[state.owner] ?? ''
    const discount = couponCode ? couponDiscount(couponCode, subtotal)?.discountEth ?? '0.00' : '0.00'
    return HttpResponse.json({ items, total: items.length, couponCode, subtotalEth: subtotal.toFixed(2), discountEth: discount, networkFeeEth: '0.01', totalEth: (Math.max(0, subtotal - Number(discount)) + 0.01).toFixed(2) })
  }),
  http.post('/api/cart/items', async ({ request }) => {
    const state = cartForRequest(request)
    if (!state) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as CartItem
    const nft = nfts.find((item) => item.id === body.nftId)
    if (!nft) return HttpResponse.json({ code: 'NFT_NOT_FOUND' }, { status: 404 })
    const existing = state.items.find((item) => item.nftId === body.nftId)
    if (existing) existing.quantity = Math.min(nft.available, existing.quantity + body.quantity)
    else state.items.push({ nftId: body.nftId, quantity: Math.min(nft.available, Math.max(1, body.quantity)) })
    saveCarts(state.carts)
    return HttpResponse.json({ items: state.items, total: state.items.length }, { status: 201 })
  }),
  http.patch('/api/cart/items/:id', async ({ params, request }) => {
    const state = cartForRequest(request)
    if (!state) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as { quantity: number }
    const item = state.items.find((entry) => entry.nftId === params.id)
    const nft = nfts.find((entry) => entry.id === params.id)
    if (!item || !nft) return HttpResponse.json({ code: 'ITEM_NOT_FOUND' }, { status: 404 })
    if (body.quantity > nft.available) return HttpResponse.json({ code: 'INSUFFICIENT_STOCK' }, { status: 409 })
    item.quantity = Math.max(1, Math.floor(body.quantity)); saveCarts(state.carts)
    return HttpResponse.json({ ...item })
  }),
  http.delete('/api/cart/items/:id', ({ params, request }) => {
    const state = cartForRequest(request)
    if (!state) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    state.carts[state.owner] = state.items.filter((item) => item.nftId !== params.id)
    saveCarts(state.carts)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post('/api/orders', async ({ request }) => {
    const state = cartForRequest(request)
    if (!state || state.owner === 'guest') return HttpResponse.json({ code: 'AUTH_REQUIRED', message: 'Entre na sua conta antes de confirmar a compra.' }, { status: 401 })
    const key = request.headers.get('Idempotency-Key')
    if (!key) return HttpResponse.json({ code: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 })
    const body = await request.json() as { buyer?: { name?: string; email?: string }; walletAddress?: string; network?: string; couponCode?: string; scenario?: string; quotedItems?: { nftId: string; quantity: number; priceEth: string; version: number }[] }
    if (!body.walletAddress || !body.network) return HttpResponse.json({ code: 'CHECKOUT_REQUIRED', message: 'Selecione uma carteira cadastrada e uma rede.' }, { status: 422 })
    if (!body.buyer?.name?.trim() || !/^\S+@\S+\.\S+$/.test(body.buyer.email ?? '')) return HttpResponse.json({ code: 'BUYER_INVALID', message: 'Confira os dados do colecionador.' }, { status: 422 })
    const accountId = state.owner.replace(/^user:/, '')
    const walletStore = JSON.parse(localStorage.getItem('kurio-wallets') ?? '{}') as Record<string, { address: string; network: string }[]>
    const wallet = walletStore[accountId]?.find((item) => item.address.toLowerCase() === body.walletAddress!.toLowerCase())
    if (!wallet || wallet.network !== body.network) return HttpResponse.json({ code: 'WALLET_INVALID', message: 'Selecione uma carteira cadastrada para a rede escolhida.' }, { status: 422 })
    const storedOrders = readOrders()
    const signature = JSON.stringify({ items: [...(body.quotedItems ?? [])].sort((a, b) => a.nftId.localeCompare(b.nftId)), couponCode: body.couponCode ?? '', walletAddress: body.walletAddress, network: body.network, buyer: body.buyer, scenario: body.scenario })
    const previous = storedOrders.find((entry) => entry.owner === state.owner && entry.key === key)
    if (previous) {
      if (previous.signature !== signature) return HttpResponse.json({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'A chave já foi usada com dados diferentes.' }, { status: 409 })
      return HttpResponse.json(previous.order)
    }
    const couponCode = readCoupons()[state.owner] ?? ''
    if ((body.couponCode ?? '') !== couponCode) return HttpResponse.json({ code: 'COUPON_CHANGED', message: 'O cupom mudou. Atualize o carrinho antes de continuar.' }, { status: 409 })
    const quotes = new Map((body.quotedItems ?? []).map((item) => [item.nftId, item]))
    for (const item of state.items) {
      const nft = nfts.find((entry) => entry.id === item.nftId); const quote = quotes.get(item.nftId)
      if (!nft || !quote || quote.quantity !== item.quantity || quote.priceEth !== nft.priceEth || quote.version !== nft.version) return HttpResponse.json({ code: 'QUOTE_CHANGED', message: 'Preço ou disponibilidade mudou. Atualize o carrinho e revise novamente.' }, { status: 409 })
    }
    if (!state.items.length) return HttpResponse.json({ code: 'CART_EMPTY' }, { status: 409 })
    for (const item of state.items) {
      const nft = nfts.find((entry) => entry.id === item.nftId)
      if (!nft || nft.available < item.quantity) return HttpResponse.json({ code: 'INSUFFICIENT_STOCK' }, { status: 409 })
    }
    const orderItems: OrderItem[] = state.items.map((item) => {
      const nft = nfts.find((entry) => entry.id === item.nftId)!
      return { ...item, name: nft.name, collection: nft.collection, priceEth: nft.priceEth, version: nft.version }
    })
    const subtotal = orderItems.reduce((sum, item) => sum + Number(item.priceEth) * item.quantity, 0)
    const discount = couponCode ? couponDiscount(couponCode, subtotal)?.discountEth ?? '0.00' : '0.00'
    const status: Order['status'] = body.scenario === 'pending' ? 'pending' : body.scenario === 'declined' ? 'declined' : 'confirmed'
    const order: Order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status,
      createdAt: new Date().toISOString(),
      items: orderItems,
      subtotalEth: subtotal.toFixed(2),
      discountEth: discount,
      couponCode,
      networkFeeEth: '0.01',
      totalEth: (Math.max(0, subtotal - Number(discount)) + 0.01).toFixed(2),
      walletAddress: body.walletAddress,
      network: body.network,
      version: 1,
    }
    if (status === 'confirmed') {
      const balanceCents = Math.round(getSimulatedWalletBalance(accountId) * 100)
      const totalCents = Math.round(Number(order.totalEth) * 100)
      if (balanceCents < totalCents) return HttpResponse.json({ code: 'INSUFFICIENT_BALANCE', message: 'Saldo simulado insuficiente. Recarregue a carteira e tente novamente.' }, { status: 422 })
      setSimulatedWalletBalance(accountId, (balanceCents - totalCents) / 100)
    }
    storedOrders.push({ owner: state.owner, key, signature, order })
    saveOrders(storedOrders)
    if (status === 'confirmed') {
      state.items.forEach((item) => { const nft = nfts.find((entry) => entry.id === item.nftId)!; nft.available -= item.quantity; nft.version += 1 })
      state.carts[state.owner] = []; const coupons = readCoupons(); delete coupons[state.owner]; saveCoupons(coupons); saveCarts(state.carts)
    }
    emitMockSocketEvent('order.updated', { id: order.id, resource: 'order', version: 1, status: order.status }, state.owner)
    if (body.scenario === 'timeout') return HttpResponse.json({ code: 'TRANSIENT_TIMEOUT', message: 'O pedido foi recebido, mas a resposta expirou. Tente novamente para recuperar o mesmo pedido.' }, { status: 504 })
    return HttpResponse.json(order, { status: 201 })
  }),
  http.post('/api/orders/:id/resolve', async ({ params, request }) => {
    const owner = ownerForRequest(request)
    if (!owner || owner === 'guest') return HttpResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
    const body = await request.json() as { status: 'confirmed' | 'declined' }
    const storedOrders = readOrders(); const entry = storedOrders.find((item) => item.owner === owner && item.order.id === params.id)
    if (!entry) return HttpResponse.json({ code: 'ORDER_NOT_FOUND' }, { status: 404 })
    if (entry.order.status !== 'pending') return HttpResponse.json(entry.order)
    if (body.status === 'confirmed') {
      const state = cartForRequest(request)
      if (!state) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
      const cartMatchesOrder = entry.order.items.length === state.items.length && entry.order.items.every((purchased) => state.items.some((item) => item.nftId === purchased.nftId && item.quantity === purchased.quantity))
      if (!cartMatchesOrder || (readCoupons()[owner] ?? '') !== entry.order.couponCode) return HttpResponse.json({ code: 'CART_CHANGED', message: 'O carrinho ou cupom mudou. Revise o pedido antes de confirmar.' }, { status: 409 })
      for (const item of entry.order.items) {
        const nft = nfts.find((candidate) => candidate.id === item.nftId)
        if (!nft || nft.available < item.quantity || nft.priceEth !== item.priceEth || nft.version !== item.version) return HttpResponse.json({ code: 'QUOTE_CHANGED', message: 'Preço ou disponibilidade mudou. Revise o carrinho.' }, { status: 409 })
      }
      const accountId = owner.replace(/^user:/, '')
      const balanceCents = Math.round(getSimulatedWalletBalance(accountId) * 100)
      const totalCents = Math.round(Number(entry.order.totalEth) * 100)
      if (balanceCents < totalCents) return HttpResponse.json({ code: 'INSUFFICIENT_BALANCE', message: 'Saldo simulado insuficiente. Recarregue a carteira e tente novamente.' }, { status: 422 })
      setSimulatedWalletBalance(accountId, (balanceCents - totalCents) / 100)
      entry.order.items.forEach((item) => { const nft = nfts.find((candidate) => candidate.id === item.nftId)!; nft.available -= item.quantity; nft.version += 1 })
      for (const purchased of entry.order.items) {
        const remaining = state.items.find((item) => item.nftId === purchased.nftId)!
        remaining.quantity -= purchased.quantity
        if (remaining.quantity <= 0) state.items.splice(state.items.indexOf(remaining), 1)
      }
      const coupons = readCoupons(); delete coupons[owner]; saveCoupons(coupons); saveCarts(state.carts)
    }
    entry.order.status = body.status; entry.order.version += 1; saveOrders(storedOrders)
    emitMockSocketEvent('order.updated', { id: entry.order.id, resource: 'order', version: entry.order.version, status: entry.order.status }, owner)
    return HttpResponse.json(entry.order)
  }),
  http.get('/api/orders/:id', ({ params, request }) => {
    const owner = ownerForRequest(request)
    if (!owner) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const stored = readOrders().find((entry) => entry.owner === owner && entry.order.id === params.id)
    if (!stored) return HttpResponse.json({ code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado.' }, { status: 404 })
    return HttpResponse.json(stored.order)
  }),
  http.get('/api/nfts', async ({ request }) => {
    const scenario = request.headers.get('X-Mock-Scenario')
    if (scenario === 'slow') await delay(1200)
    else if (scenario === 'variable-latency') await delay(80 + Math.random() * 650)
    else await delay(100)

    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const category = url.searchParams.get('category')
    const sort = url.searchParams.get('sort') ?? 'newest'
    const network = url.searchParams.get('network') ?? 'all'
    const maxPrice = Number(url.searchParams.get('maxPrice') ?? '12.3')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(
      24,
      Math.max(1, Number(url.searchParams.get('pageSize') ?? 6)),
    )

    let result = nfts.filter((nft) => {
      const matchesSearch =
        `${nft.name} ${nft.collection} ${nft.creator}`
          .toLowerCase()
          .includes(search)

      const matchesCategory =
        !category || category === 'all' || nft.category === category

      const matchesNetwork = network === 'all' || nft.network === network
      const matchesPrice = Number(nft.priceEth) <= maxPrice

      return matchesSearch && matchesCategory && matchesNetwork && matchesPrice
    })

    if (sort === 'price-asc') {
      result = [...result].sort(
        (a, b) => Number(a.priceEth) - Number(b.priceEth),
      )
    } else if (sort === 'price-desc') {
      result = [...result].sort(
        (a, b) => Number(b.priceEth) - Number(a.priceEth),
      )
    } else {
      result = [...result].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
    }

    const total = result.length
    const start = (page - 1) * pageSize

    return HttpResponse.json({
      items: result.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    })
  }),

  http.get('/api/nfts/:id', async ({ params, request }) => {
    const scenario = request.headers.get('X-Mock-Scenario')
    if (scenario === 'slow') await delay(1200)
    else if (scenario === 'variable-latency') await delay(80 + Math.random() * 650)

    const nft = nfts.find((item) => item.id === params.id)

    if (!nft) {
      return HttpResponse.json(
        { code: 'NFT_NOT_FOUND', message: 'NFT não encontrado.' },
        { status: 404 },
      )
    }

    return HttpResponse.json(nft)
  }),
]
