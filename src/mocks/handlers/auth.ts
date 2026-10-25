import { http, HttpResponse, delay } from 'msw'

type Wallet = { id: string; label: string; address: string; network: 'Ethereum' | 'Polygon' | 'Solana'; primary: boolean }
type User = { id: string; name: string; email: string; avatar: string; passwordDigest: string }
type AuthState = { users: User[]; sessions: Record<string, string> }
const authStorageKey = 'kurio-auth-state'
const walletStorageKey = 'kurio-wallets'
const initialState: AuthState = { users: [{ id: 'demo-1', name: 'Colecionador Demo', email: 'demo@kurio.test', avatar: '', passwordDigest: 'demo' }, { id: 'demo-2', name: 'Alex Colecionador', email: 'alex@kurio.test', avatar: '', passwordDigest: 'demo' }], sessions: {} }
const readState = (): AuthState => JSON.parse(localStorage.getItem(authStorageKey) ?? JSON.stringify(initialState)) as AuthState
const saveState = (state: AuthState) => localStorage.setItem(authStorageKey, JSON.stringify(state))
const digest = async (password: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
const publicUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, avatar: user.avatar })
export const getMockUserId = (token: string) => readState().sessions[token]
function authenticatedUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '')
  if (!token) return null
  const state = readState()
  const id = state.sessions[token]
  return id ? state.users.find((user) => user.id === id) ?? null : null
}
function readWallets(): Record<string, Wallet[]> { return JSON.parse(localStorage.getItem(walletStorageKey) ?? '{}') as Record<string, Wallet[]> }
function saveWallets(wallets: Record<string, Wallet[]>) { localStorage.setItem(walletStorageKey, JSON.stringify(wallets)) }

export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    await delay(180)
    const body = await request.json() as { name: string; email: string; password: string }
    const state = readState(); const email = body.email.trim().toLowerCase()
    if (state.users.some((user) => user.email === email)) return HttpResponse.json({ code: 'EMAIL_TAKEN', message: 'Este e-mail já possui cadastro.' }, { status: 409 })
    if (body.name.trim().length < 2 || body.password.length < 8) return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Informe seu nome e uma senha com pelo menos 8 caracteres.' }, { status: 422 })
    const user: User = { id: crypto.randomUUID(), name: body.name.trim(), email, avatar: '', passwordDigest: await digest(body.password) }
    state.users.push(user); const token = crypto.randomUUID(); state.sessions[token] = user.id; saveState(state)
    return HttpResponse.json({ token, user: publicUser(user) }, { status: 201 })
  }),
  http.post('/api/auth/login', async ({ request }) => {
    await delay(180)
    const body = await request.json() as { email: string; password: string }; const state = readState()
    const user = state.users.find((item) => item.email === body.email.trim().toLowerCase())
    const passwordDigest = body.password === 'kurio123' && user?.passwordDigest === 'demo' ? 'demo' : await digest(body.password)
    if (!user || user.passwordDigest !== passwordDigest) return HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' }, { status: 401 })
    const token = crypto.randomUUID(); state.sessions[token] = user.id; saveState(state)
    return HttpResponse.json({ token, user: publicUser(user) })
  }),
  http.get('/api/auth/session', ({ request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    return HttpResponse.json({ user: publicUser(user) })
  }),
  http.post('/api/auth/logout', ({ request }) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    const state = readState(); if (token) delete state.sessions[token]; saveState(state)
    return new HttpResponse(null, { status: 204 })
  }),
  http.patch('/api/profile', async ({ request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as { name?: string; email?: string; avatar?: string }
    const state = readState()
    const currentUser = state.users.find((entry) => entry.id === user.id)!
    const name = body.name?.trim() ?? currentUser.name
    const email = body.email?.trim().toLowerCase() ?? currentUser.email
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Informe nome e e-mail válidos.' }, { status: 422 })
    if (state.users.some((other) => other.id !== user.id && other.email === email)) return HttpResponse.json({ code: 'EMAIL_TAKEN', message: 'Este e-mail já está em uso.' }, { status: 409 })
    currentUser.name = name; currentUser.email = email; currentUser.avatar = body.avatar?.trim() ?? currentUser.avatar; saveState(state)
    return HttpResponse.json(publicUser(currentUser))
  }),
  http.patch('/api/profile/password', async ({ request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as { currentPassword: string; newPassword: string }
    const state = readState(); const currentUser = state.users.find((entry) => entry.id === user.id)!
    const oldDigest = body.currentPassword === 'kurio123' && currentUser.passwordDigest === 'demo' ? 'demo' : await digest(body.currentPassword)
    if (oldDigest !== currentUser.passwordDigest) return HttpResponse.json({ code: 'INVALID_PASSWORD', message: 'A senha atual não confere.' }, { status: 422 })
    if (body.newPassword.length < 8) return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 422 })
    currentUser.passwordDigest = await digest(body.newPassword); saveState(state)
    return HttpResponse.json({ updated: true })
  }),
  http.get('/api/wallets', ({ request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const wallets = readWallets()[user.id] ?? []
    return HttpResponse.json(wallets)
  }),
  http.post('/api/wallets', async ({ request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as Omit<Wallet, 'id' | 'primary'>
    if (!body.label.trim() || !/^0x[a-fA-F0-9]{40}$/.test(body.address)) return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Informe um nome e endereço Ethereum válido (0x + 40 caracteres hexadecimais).' }, { status: 422 })
    const all = readWallets(); const own = all[user.id] ?? []
    if (own.some((wallet) => wallet.address.toLowerCase() === body.address.toLowerCase())) return HttpResponse.json({ code: 'WALLET_EXISTS', message: 'Esta carteira já está cadastrada.' }, { status: 409 })
    const wallet: Wallet = { ...body, id: crypto.randomUUID(), primary: own.length === 0 }
    all[user.id] = [...own, wallet]; saveWallets(all)
    return HttpResponse.json(wallet, { status: 201 })
  }),
  http.patch('/api/wallets/:id', async ({ params, request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const body = await request.json() as Partial<Pick<Wallet, 'label' | 'address' | 'network' | 'primary'>>
    const all = readWallets(); const own = all[user.id] ?? []; const target = own.find((wallet) => wallet.id === params.id)
    if (!target) return HttpResponse.json({ code: 'WALLET_NOT_FOUND' }, { status: 404 })
    if (body.label !== undefined && !body.label.trim()) return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'O nome da carteira não pode ficar vazio.' }, { status: 422 })
    if (body.address !== undefined && !/^0x[a-fA-F0-9]{40}$/.test(body.address)) return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Informe um endereço Ethereum válido.' }, { status: 422 })
    if (body.address !== undefined && own.some((wallet) => wallet.id !== target.id && wallet.address.toLowerCase() === body.address!.toLowerCase())) return HttpResponse.json({ code: 'WALLET_EXISTS', message: 'Esta carteira já está cadastrada.' }, { status: 409 })
    if (body.primary) own.forEach((wallet) => { wallet.primary = false })
    Object.assign(target, body); all[user.id] = own; saveWallets(all)
    return HttpResponse.json(target)
  }),
  http.delete('/api/wallets/:id', ({ params, request }) => {
    const user = authenticatedUser(request)
    if (!user) return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
    const all = readWallets(); const own = all[user.id] ?? []
    if (!own.some((wallet) => wallet.id === params.id)) return HttpResponse.json({ code: 'WALLET_NOT_FOUND' }, { status: 404 })
    all[user.id] = own.filter((wallet) => wallet.id !== params.id)
    if (own.find((wallet) => wallet.id === params.id)?.primary && all[user.id][0]) all[user.id][0].primary = true
    saveWallets(all); return new HttpResponse(null, { status: 204 })
  }),
]
