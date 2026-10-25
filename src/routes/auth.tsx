import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { clearSession, saveSession, sessionUserId, type PublicUser } from '../lib/session'

type AuthResponse = { token: string; user: PublicUser }
type WalletBalance = { balanceEth: string }

export function AuthPage({ mode, returnTo = '/' }: { mode: 'login' | 'register'; returnTo?: string }) {
  const client = useQueryClient(); const navigate = useNavigate(); const [message, setMessage] = useState('')
  const mutation = useMutation({
    mutationFn: async (body: { name?: string; email: string; password: string }) => (await api.post<AuthResponse>(`/auth/${mode}`, body)).data,
    onSuccess: async ({ token, user }) => { saveSession(token, user.id); client.setQueryData(['session'], user); await client.invalidateQueries(); if (returnTo !== '/') window.location.assign(returnTo); else await navigate({ to: '/' }) },
    onError: (error: unknown) => { const data = (error as { response?: { data?: { message?: string } } }).response?.data; setMessage(data?.message ?? 'Não foi possível concluir. Verifique sua conexão e tente novamente.') },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setMessage(''); const data = new FormData(event.currentTarget); mutation.mutate({ name: String(data.get('name') ?? ''), email: String(data.get('email')), password: String(data.get('password')) }) }
  return <main className="auth-page"><Link to="/" className="text-link">← Voltar ao catálogo</Link><form className="auth-card" onSubmit={submit}>
    <p className="eyebrow">CONTA KURIO</p><h1>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h1><p className="muted">{mode === 'login' ? 'Acesse sua coleção e continue sua compra.' : 'Salve favoritos e acompanhe seus pedidos.'}</p>
    {mode === 'register' && <label>Nome completo<input name="name" autoComplete="name" required minLength={2} /></label>}
    <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
    <label>Senha<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} aria-describedby="password-help" /></label>
    {mode === 'register' && <span id="password-help" className="muted small">Use pelo menos 8 caracteres.</span>}
    {message && <p role="alert" className="auth-error">{message}</p>}
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
    <p className="auth-switch">{mode === 'login' ? 'Ainda não tem conta?' : 'Já possui cadastro?'} <Link className="text-link" to={mode === 'login' ? '/register' : '/login'} search={{ returnTo }}>{mode === 'login' ? 'Cadastre-se' : 'Faça login'}</Link></p>
    {mode === 'login' && <p className="muted small">Conta de demonstração: demo@kurio.test · senha: kurio123</p>}
  </form></main>
}

export function AccountPage() {
  const client = useQueryClient(); const navigate = useNavigate(); const [feedback, setFeedback] = useState('')
  const session = useQuery({ queryKey: ['session'], queryFn: async () => (await api.get<{ user: PublicUser }>('/auth/session')).data.user, retry: false })
  const wallets = useQuery({ queryKey: ['wallets', sessionUserId()], queryFn: async () => (await api.get<Wallet[]>('/wallets')).data, enabled: session.isSuccess })
  const balance = useQuery({ queryKey: ['wallet-balance', sessionUserId()], queryFn: async () => (await api.get<WalletBalance>('/wallets/balance')).data, enabled: session.isSuccess })
  const favoriteIds = useQuery({ queryKey: ['favorites', sessionUserId()], queryFn: async () => (await api.get<{ items: string[] }>('/favorites')).data.items, enabled: session.isSuccess })
  const favorites = useQuery({ queryKey: ['favorite-nfts', favoriteIds.data], queryFn: async () => Promise.all((favoriteIds.data ?? []).map(async (id) => (await api.get<NFT>(`/nfts/${id}`)).data)), enabled: Boolean(favoriteIds.data?.length) })
  const profile = useMutation({ mutationFn: (body: { name: string; email: string; avatar: string }) => api.patch<PublicUser>('/profile', body), onSuccess: async ({ data }) => { client.setQueryData(['session'], data); setFeedback('Perfil atualizado.') }, onError: (error) => setFeedback(apiError(error)) })
  const password = useMutation({ mutationFn: (body: { currentPassword: string; newPassword: string }) => api.patch('/profile/password', body), onSuccess: () => setFeedback('Senha alterada.'), onError: (error) => setFeedback(apiError(error)) })
  const addWallet = useMutation({ mutationFn: (body: { label: string; address: string; network: Wallet['network'] }) => api.post('/wallets', body), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['wallets'] }); setFeedback('Carteira cadastrada.') }, onError: (error) => setFeedback(apiError(error)) })
  const createDemoWallet = useMutation({ mutationFn: () => api.post<Wallet>('/wallets/demo'), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['wallets'] }); setFeedback('Carteira simulada criada.') }, onError: (error) => setFeedback(apiError(error)) })
  const topUpWallet = useMutation({ mutationFn: async () => (await api.post<WalletBalance>('/wallets/balance/top-up')).data, onSuccess: async (data) => { client.setQueryData(['wallet-balance', sessionUserId()], data); setFeedback('1 ETH fictício adicionado ao saldo.') }, onError: (error) => setFeedback(apiError(error)) })
  const updateWallet = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: object }) => api.patch(`/wallets/${id}`, patch), onSuccess: () => client.invalidateQueries({ queryKey: ['wallets'] }), onError: (error) => setFeedback(apiError(error)) })
  const deleteWallet = useMutation({ mutationFn: (id: string) => api.delete(`/wallets/${id}`), onSuccess: () => client.invalidateQueries({ queryKey: ['wallets'] }), onError: (error) => setFeedback(apiError(error)) })
  const removeFavorite = useMutation({ mutationFn: (id: string) => api.delete(`/favorites/${id}`), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['favorites'] }); await client.invalidateQueries({ queryKey: ['favorite-nfts'] }) } })
  const logout = useMutation({ mutationFn: () => api.post('/auth/logout'), onSuccess: async () => { clearSession(); client.clear(); await navigate({ to: '/' }) } })
  if (session.isPending) return <main className="feedback-panel"><h1>Carregando sua conta…</h1></main>
  if (session.isError) return <main className="feedback-panel"><h1>Sessão encerrada</h1><p>Entre novamente para acessar sua conta.</p><Link className="button" to="/login" search={{ returnTo: '/account' }}>Entrar</Link></main>
  return <main className="account-page"><p className="eyebrow">MINHA CONTA</p><h1>Olá, {session.data.name}</h1><p className="muted">{session.data.email}</p>
    {feedback && <p role="status" aria-live="polite">{feedback}</p>}
    <form className="account-card" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); profile.mutate({ name: String(data.get('name')), email: String(data.get('email')), avatar: String(data.get('avatar')) }) }}><h2>Perfil do colecionador</h2>{session.data.avatar && <img className="profile-avatar" src={session.data.avatar} alt={`Avatar de ${session.data.name}`} />}<label>Nome completo<input name="name" required minLength={2} defaultValue={session.data.name} /></label><label>E-mail<input name="email" type="email" required defaultValue={session.data.email} /></label><label>URL do avatar<input name="avatar" type="url" defaultValue={session.data.avatar ?? ''} placeholder="https://…" /></label><button className="button" disabled={profile.isPending}>Salvar perfil</button></form>
    <form className="account-card" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); password.mutate({ currentPassword: String(data.get('currentPassword')), newPassword: String(data.get('newPassword')) }); event.currentTarget.reset() }}><h2>Alterar senha</h2><label>Senha atual<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nova senha<input name="newPassword" type="password" required minLength={8} autoComplete="new-password" /></label><button className="button" disabled={password.isPending}>Atualizar senha</button></form>
    <section className="account-card wallet-balance-card"><h2>Saldo da carteira de demonstração</h2><p className="muted">Crédito fictício em ETH. Não é dinheiro real e não pode ser transferido.</p>{balance.isPending ? <p>Carregando saldo…</p> : balance.isError ? <p role="alert">Não foi possível carregar o saldo simulado.</p> : <div className="wallet-balance-actions"><strong>{Number(balance.data.balanceEth).toFixed(2)} ETH</strong><button className="button button-small" disabled={topUpWallet.isPending} onClick={() => topUpWallet.mutate()}>{topUpWallet.isPending ? 'Adicionando…' : 'Adicionar 1 ETH fictício'}</button></div>}</section>
    <section className="account-card"><h2>Carteiras</h2><p className="muted">As carteiras e os endereços desta demonstração são fictícios; nenhuma chave privada é criada ou armazenada.</p><button className="button button-small" disabled={createDemoWallet.isPending} onClick={() => createDemoWallet.mutate()}>{createDemoWallet.isPending ? 'Criando…' : 'Criar carteira simulada'}</button>{wallets.data?.map((wallet) => <article className="wallet-row" key={wallet.id}><form className="wallet-edit" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); updateWallet.mutate({ id: wallet.id, patch: { label: String(data.get('label')), address: String(data.get('address')), network: String(data.get('network')) } }) }}><label>Nome da carteira<input name="label" required defaultValue={wallet.label} /></label><label>Endereço<input name="address" required pattern="0x[a-fA-F0-9]{40}" defaultValue={wallet.address} /></label><label>Rede<select name="network" defaultValue={wallet.network}><option>Ethereum</option><option>Polygon</option><option>Solana</option></select></label><button className="text-link">Salvar edição</button></form><strong>{wallet.primary ? 'Principal' : 'Secundária'}</strong><div>{!wallet.primary && <button className="text-link" onClick={() => updateWallet.mutate({ id: wallet.id, patch: { primary: true } })}>Definir como principal</button>}<button className="text-link" onClick={() => deleteWallet.mutate(wallet.id)}>Remover</button></div></article>)}<form className="wallet-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); addWallet.mutate({ label: String(data.get('label')), address: String(data.get('address')), network: String(data.get('network')) as Wallet['network'] }); event.currentTarget.reset() }}><h3>Adicionar carteira</h3><label>Nome<input name="label" required /></label><label>Endereço Ethereum<input name="address" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x + 40 caracteres hexadecimais" /></label><label>Rede<select name="network"><option>Ethereum</option><option>Polygon</option><option>Solana</option></select></label><button className="button" disabled={addWallet.isPending}>Cadastrar carteira</button></form></section>
    <section className="account-card"><h2>Favoritos</h2>{favoriteIds.data?.length ? favorites.data?.map((nft) => <article className="favorite-row" key={nft.id}><img src={nft.image} alt=""/><span>{nft.name}</span><button className="text-link" onClick={() => removeFavorite.mutate(nft.id)}>Remover</button></article>) : <p>Você ainda não salvou NFTs favoritos.</p>}</section>
    <section className="account-card"><button className="button" disabled={logout.isPending} onClick={() => logout.mutate()}>{logout.isPending ? 'Saindo…' : 'Sair da conta'}</button></section>
  </main>
}

type Wallet = { id: string; label: string; address: string; network: 'Ethereum' | 'Polygon' | 'Solana'; primary: boolean }
type NFT = { id: string; name: string; image: string }
function apiError(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Não foi possível salvar. Tente novamente.' }
