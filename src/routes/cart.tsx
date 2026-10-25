import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../lib/api'
import { cartQueryKey } from '../lib/session'
import type { NFT } from '../types/nft'

type Cart = { items: { nftId: string; quantity: number; nft: NFT }[]; couponCode?: string; discountEth?: string; networkFeeEth?: string; totalEth?: string }
const eth = (value: number) => value.toFixed(2)

export function CartPage() {
  const client = useQueryClient()
  const [couponDraft, setCouponDraft] = useState('')
  const cart = useQuery({ queryKey: cartQueryKey(), queryFn: async () => (await api.get<Cart>('/cart')).data })
  const change = useMutation({ mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.patch(`/cart/items/${id}`, { quantity }), onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/cart/items/${id}`), onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  const coupon = useMutation({ mutationFn: (code: string) => api.post('/cart/coupon', { code }), onSuccess: () => { setCouponDraft(''); client.invalidateQueries({ queryKey: cartQueryKey() }) } })
  const removeCoupon = useMutation({ mutationFn: () => api.post('/cart/coupon', { code: '' }), onSuccess: () => client.invalidateQueries({ queryKey: cartQueryKey() }) })
  if (cart.isPending) return <main className="feedback-panel"><h1>Seu carrinho</h1><div className="skeleton-line shimmer" /></main>
  if (cart.isError) return <main className="feedback-panel"><h1>Carrinho indisponível</h1><button className="button" onClick={() => cart.refetch()}>Tentar novamente</button></main>
  const subtotal = cart.data.items.reduce((sum, item) => sum + Number(item.nft.priceEth) * item.quantity, 0)
  const discount = Number(cart.data.discountEth ?? 0)
  const networkFee = Number(cart.data.networkFeeEth ?? .01)
  return <main className="cart-page">
    <Link to="/" className="text-link">← Continuar explorando</Link><h1>Seu carrinho</h1>
    {cart.data.items.length === 0 ? <section className="feedback-panel"><h2>Seu carrinho está vazio</h2><p>Encontre uma peça para começar sua coleção.</p><Link to="/" className="button">Explorar NFTs</Link></section> : <div className="cart-layout">
      <section className="cart-items" aria-label="Itens do carrinho">{cart.data.items.map(({ nft, quantity, nftId }) => <article className="cart-item" key={nftId}>
        <img src={nft.image} alt={nft.name} /><div className="cart-item-info"><span className="muted">{nft.collection}</span><h2>{nft.name}</h2><strong>{nft.priceEth} ETH</strong>
        <label>Quantidade <select aria-label={`Quantidade de ${nft.name}`} value={quantity} onChange={(e) => change.mutate({ id: nftId, quantity: Number(e.target.value) })}>{Array.from({ length: nft.available }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
        <button className="text-link remove-item" onClick={() => remove.mutate(nftId)}>Remover</button></div>
      </article>)}</section>
      <aside className="cart-summary"><h2>Resumo do pedido</h2><div><span>Subtotal</span><strong>{eth(subtotal)} ETH</strong></div>
        <form className="coupon-form" onSubmit={(event) => { event.preventDefault(); coupon.mutate(couponDraft) }}><label htmlFor="coupon-code">Cupom</label><div><input id="coupon-code" value={couponDraft} onChange={(event) => setCouponDraft(event.target.value)} placeholder="Ex.: KURIO10" /><button className="button button-small" disabled={coupon.isPending}>Aplicar</button></div></form>
        {cart.data.couponCode && <div><span>Cupom {cart.data.couponCode} · desconto</span><strong>−{eth(discount)} ETH <button className="text-link" onClick={() => removeCoupon.mutate()}>Remover</button></strong></div>}
        {(coupon.isError || coupon.data) && <p role={coupon.isError ? 'alert' : 'status'}>{coupon.isError ? (coupon.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Cupom inválido.' : 'Cupom aplicado.'}</p>}
        <div><span>Taxa de rede (estimada)</span><strong>{eth(networkFee)} ETH</strong></div><hr/><div><strong>Total</strong><strong>{eth(Number(cart.data.totalEth ?? Math.max(0, subtotal - discount) + networkFee))} ETH</strong></div><p className="muted small">A cotação será confirmada antes do envio do pedido.</p><Link className="button" to="/checkout">Continuar para pagamento</Link><p role="status" aria-live="polite">{change.isError || remove.isError ? 'Não foi possível atualizar o carrinho.' : ''}</p></aside>
    </div>}
  </main>
}
