import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { cartQueryKey, sessionToken, sessionUserId, type PublicUser } from '../lib/session'
import type { NFT } from '../types/nft'

type Wallet = { id: string; label: string; address: string; network: 'Ethereum' | 'Polygon' | 'Solana'; primary: boolean }
type WalletBalance = { balanceEth: string }
type Cart = { items: { nftId: string; quantity: number; nft: NFT }[]; couponCode?: string; discountEth?: string; subtotalEth?: string; networkFeeEth?: string; totalEth?: string }
type OrderItem = { nftId: string; quantity: number; name: string; collection: string; priceEth: string }
type Order = { id: string; status: 'pending' | 'confirmed' | 'declined'; items: OrderItem[]; subtotalEth: string; discountEth: string; couponCode: string; networkFeeEth: string; totalEth: string; walletAddress: string; network: string; version: number }
const keyName = 'kurio-order-attempt'
const eth = (value: string | number) => Number(value).toFixed(2)

export function CheckoutPage() {
  const client = useQueryClient(); const navigate = useNavigate()
  const session = useQuery({ queryKey: ['session'], queryFn: async () => (await api.get<{ user: PublicUser }>('/auth/session')).data.user, enabled: Boolean(sessionToken()), retry: false })
  const cart = useQuery({ queryKey: cartQueryKey(), queryFn: async () => (await api.get<Cart>('/cart')).data, enabled: session.isSuccess })
  const wallets = useQuery({ queryKey: ['wallets', sessionUserId()], queryFn: async () => (await api.get<Wallet[]>('/wallets')).data, enabled: session.isSuccess })
  const walletBalance = useQuery({ queryKey: ['wallet-balance', sessionUserId()], queryFn: async () => (await api.get<WalletBalance>('/wallets/balance')).data, enabled: session.isSuccess })
  const [walletId, setWalletId] = useState(''); const [network, setNetwork] = useState<'Ethereum' | 'Polygon' | 'Solana'>('Ethereum'); const [connected, setConnected] = useState(false); const [error, setError] = useState('')
  const selectedWallet = wallets.data?.find((wallet) => wallet.id === walletId) ?? wallets.data?.find((wallet) => wallet.primary) ?? wallets.data?.[0]
  const selectedNetwork = walletId ? network : selectedWallet?.network ?? network
  const order = useMutation({
    mutationFn: async (form: { name: string; email: string }) => {
      if (!selectedWallet) throw new Error('Cadastre uma carteira na sua conta antes de pagar.')
      let key = sessionStorage.getItem(keyName)
      if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(keyName, key) }
      const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'confirmed'
      return (await api.post<Order>('/orders', {
        buyer: form, walletAddress: selectedWallet.address, network: selectedNetwork,
        couponCode: cart.data?.couponCode ?? '', scenario,
        quotedItems: cart.data?.items.map(({ nftId, quantity, nft }) => ({ nftId, quantity, priceEth: nft.priceEth, version: nft.version })) ?? [],
      }, { headers: { 'Idempotency-Key': key } })).data
    },
    onSuccess: async (data) => {
      if (data.status !== 'pending') sessionStorage.removeItem(keyName)
      await client.invalidateQueries({ queryKey: cartQueryKey() })
      await client.invalidateQueries({ queryKey: ['wallet-balance', sessionUserId()] })
      await navigate({ to: '/receipt/$orderId', params: { orderId: data.id } })
    },
    onError: (cause) => setError((cause as { response?: { data?: { message?: string } } }).response?.data?.message ?? (cause instanceof Error ? cause.message : 'Não foi possível enviar o pedido.')),
  })
  if (!sessionToken()) return <main className="feedback-panel"><h1>Entre para continuar</h1><p>O checkout é exclusivo para colecionadores autenticados.</p><Link className="button" to="/login" search={{ returnTo: '/checkout' }}>Entrar</Link><Link to="/register" search={{ returnTo: '/checkout' }} className="text-link">Criar conta</Link></main>
  if (session.isPending || cart.isPending || wallets.isPending || walletBalance.isPending) return <main className="feedback-panel"><h1>Revisão do pedido</h1><div className="skeleton-line shimmer" /></main>
  if (session.isError) return <main className="feedback-panel"><h1>Sessão encerrada</h1><p>Entre novamente para continuar com o pedido.</p><Link className="button" to="/login" search={{ returnTo: '/checkout' }}>Entrar</Link></main>
  if (cart.isError || wallets.isError || walletBalance.isError) return <main className="feedback-panel"><h1>Não foi possível carregar o checkout</h1><button className="button" onClick={() => { void cart.refetch(); void wallets.refetch(); void walletBalance.refetch() }}>Tentar novamente</button></main>
  if (!cart.data.items.length) return <main className="feedback-panel"><h1>Nenhum item para pagar</h1><Link to="/cart" className="button">Voltar ao carrinho</Link></main>
  const total = Number(cart.data.totalEth ?? Number(cart.data.subtotalEth ?? 0) + .01)
  const hasEnoughBalance = Number(walletBalance.data.balanceEth) >= total
  return <main className="checkout-page"><Link to="/cart" className="text-link">← Voltar ao carrinho</Link><h1>Revisão do pedido</h1>
    {!wallets.data.length && <section className="feedback-panel"><h2>Cadastre uma carteira para comprar</h2><p>Os dados da carteira são simulados e podem ser gerenciados no seu perfil.</p><Link className="button" to="/account">Abrir perfil e carteiras</Link></section>}
    <div className="checkout-layout"><form className="checkout-form" id="checkout-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); const data = new FormData(event.currentTarget); order.mutate({ name: String(data.get('name')), email: String(data.get('email')) }) }}>
      <h2>Dados do colecionador</h2><label>Nome completo<input name="name" required minLength={2} autoComplete="name" defaultValue={session.data.name} /></label><label>E-mail<input name="email" type="email" required autoComplete="email" defaultValue={session.data.email} /></label>
      <h2>Carteira e rede</h2><label>Carteira<select value={walletId || selectedWallet?.id || ''} onChange={(event) => { const selected = wallets.data.find((wallet) => wallet.id === event.target.value); setWalletId(event.target.value); setConnected(false); if (selected) setNetwork(selected.network) }} required disabled={!wallets.data.length}>{wallets.data.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.label}{wallet.primary ? ' · principal' : ''} · {wallet.address.slice(0, 8)}…</option>)}</select></label><label>Rede<select value={selectedNetwork} onChange={(event) => { setNetwork(event.target.value as typeof network); setConnected(false) }}><option>Ethereum</option><option>Polygon</option><option>Solana</option></select></label>
      <button type="button" className="button button-small" disabled={!selectedWallet} onClick={() => setConnected((value) => !value)}>{connected ? 'Desconectar carteira simulada' : 'Conectar carteira simulada'}</button><p className="muted">{connected ? `Carteira conectada em ${selectedNetwork}.` : 'Conexão simulada. Nenhuma extensão ou transação real será usada.'}</p>
    </form><aside className="cart-summary"><h2>Revisão · {cart.data.items.length} itens</h2>{cart.data.items.map(({ nft, quantity, nftId }) => <div key={nftId}><span>{nft.name} × {quantity}</span><strong>{eth(Number(nft.priceEth) * quantity)} ETH</strong></div>)}<div><span>Subtotal</span><strong>{eth(cart.data.subtotalEth ?? 0)} ETH</strong></div>{Number(cart.data.discountEth) > 0 && <div><span>Cupom {cart.data.couponCode}</span><strong>−{eth(cart.data.discountEth ?? 0)} ETH</strong></div>}<div><span>Taxa de rede</span><strong>{eth(cart.data.networkFeeEth ?? .01)} ETH</strong></div><hr/><div><strong>Total</strong><strong>{eth(total)} ETH</strong></div><div className="wallet-balance-row"><span>Saldo fictício</span><strong>{eth(walletBalance.data.balanceEth)} ETH</strong></div>{!hasEnoughBalance && <p role="alert">Saldo insuficiente. <Link className="text-link" to="/account">Adicione ETH fictício na sua conta</Link>.</p>}{error && <p role="alert">{error}</p>}<button className="button" type="submit" form="checkout-form" disabled={order.isPending || !wallets.data.length || !connected || !hasEnoughBalance}>{order.isPending ? 'Enviando pedido…' : 'Confirmar compra simulada'}</button>{!wallets.data.length && <p className="muted small">Crie uma carteira simulada em <Link className="text-link" to="/account">Minha conta</Link>.</p>}{!connected && Boolean(wallets.data.length) && <p className="muted small">Conecte a carteira simulada para liberar a confirmação.</p>}<p className="muted small">Saldo, preço e compra são fictícios. Preço, estoque, cupom e taxa serão revalidados antes da criação do pedido.</p></aside></div>
  </main>
}

export function ReceiptPage({ orderId }: { orderId: string }) {
  const client = useQueryClient(); const navigate = useNavigate(); const [message, setMessage] = useState('')
  const order = useQuery({ queryKey: ['orders', sessionUserId() ?? 'guest', orderId], queryFn: async () => (await api.get<Order>(`/orders/${encodeURIComponent(orderId)}`)).data, retry: false, refetchInterval: (query) => query.state.data?.status === 'pending' ? 3000 : false })
  const resolve = useMutation({ mutationFn: (status: 'confirmed' | 'declined') => api.post<Order>(`/orders/${encodeURIComponent(orderId)}/resolve`, { status }).then(({ data }) => data), onSuccess: async (data) => { await client.invalidateQueries({ queryKey: ['orders', sessionUserId(), orderId] }); await client.invalidateQueries({ queryKey: cartQueryKey() }); await client.invalidateQueries({ queryKey: ['wallet-balance', sessionUserId()] }); sessionStorage.removeItem(keyName); setMessage(data.status === 'confirmed' ? 'Pagamento aprovado.' : 'Pagamento recusado. Os itens permanecem no carrinho.') }, onError: (cause) => setMessage((cause as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Não foi possível atualizar o pagamento.') })
  if (order.isPending) return <main className="feedback-panel"><h1>Verificando seu pedido…</h1><div className="skeleton-line shimmer" /></main>
  if (order.isError) return <main className="feedback-panel"><h1>Pedido não encontrado</h1><p>Entre na conta que criou o pedido para consultar o recibo.</p><Link className="button" to="/login" search={{ returnTo: `/receipt/${orderId}` }}>Entrar</Link></main>
  const data = order.data
  if (data.status === 'pending') return <main className="receipt-page"><p className="eyebrow">PAGAMENTO PENDENTE</p><h1>Pedido aguardando confirmação</h1><p>Você pode retomar a simulação. O pedido é preservado ao atualizar a página.</p><ReceiptSnapshot order={data}/>{message && <p role="status">{message}</p>}<div className="receipt-actions"><button className="button" disabled={resolve.isPending} onClick={() => { sessionStorage.removeItem(keyName); resolve.mutate('confirmed') }}>Simular pagamento aprovado</button><button className="button button-outline" disabled={resolve.isPending} onClick={() => resolve.mutate('declined')}>Simular recusa</button><Link className="text-link" to="/account">Adicionar ETH fictício</Link></div></main>
  if (data.status === 'declined') return <main className="receipt-page"><p className="eyebrow">PAGAMENTO RECUSADO</p><h1>Não foi possível concluir a compra</h1><p>Os itens continuam no seu carrinho. Revise a forma de pagamento e tente novamente.</p><ReceiptSnapshot order={data}/><Link className="button" to="/cart">Voltar ao carrinho</Link></main>
  return <main className="receipt-page"><p className="eyebrow">PEDIDO CONFIRMADO</p><h1>Compra concluída</h1><p>Seu pedido de demonstração foi confirmado pela API simulada.</p><ReceiptSnapshot order={data}/><button className="button" onClick={() => navigate({ to: '/' })}>Voltar ao catálogo</button></main>
}

function ReceiptSnapshot({ order }: { order: Order }) {
  return <section className="cart-summary receipt-snapshot"><h2>Recibo · {order.id}</h2>{order.items.map((item) => <div key={item.nftId}><span>{item.name} × {item.quantity}</span><strong>{eth(Number(item.priceEth) * item.quantity)} ETH</strong></div>)}<div><span>Subtotal</span><strong>{eth(order.subtotalEth)} ETH</strong></div>{Number(order.discountEth) > 0 && <div><span>Cupom {order.couponCode}</span><strong>−{eth(order.discountEth)} ETH</strong></div>}<div><span>Taxa de rede</span><strong>{eth(order.networkFeeEth)} ETH</strong></div><hr/><div><strong>Total</strong><strong>{eth(order.totalEth)} ETH</strong></div><p>Carteira {order.walletAddress} · rede {order.network}</p><span>Referência de aquisição simulada</span><a className="text-link" href={`https://example.test/explorer/${encodeURIComponent(order.id)}`}>Consultar transação simulada</a></section>
}
