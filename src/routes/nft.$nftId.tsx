
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'
import { api } from '../lib/api'
import type { NFT } from '../types/nft'
import { FavoriteButton } from '../components/FavoriteButton'

export function NFTDetailPage({ nftId }: { nftId: string }) {
  const queryClient = useQueryClient()
  const addToCart = useMutation({
    mutationFn: () => api.post('/cart/items', { nftId, quantity: 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  })
  const query = useQuery({
    queryKey: ['nft', nftId],
    queryFn: async () => {
      const response = await api.get<NFT>(
        `/nfts/${encodeURIComponent(nftId)}`,
      )
      return response.data
    },
  })

  if (query.isPending) {
    return (
      <main className="detail-page">
        <div className="detail-skeleton shimmer" />
        <div className="detail-skeleton-text">
          <div className="skeleton-line shimmer" />
          <div className="skeleton-line shimmer" />
        </div>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="feedback-panel">
        <h1>NFT indisponível</h1>
        <p>O item não foi encontrado ou ocorreu uma falha de conexão.</p>
        <button className="button" onClick={() => query.refetch()}>
          Tentar novamente
        </button>
        <Link to="/" className="text-link">Voltar ao catálogo</Link>
      </main>
    )
  }

  const nft = query.data

  return (
    <main className="detail-page">
      <div className="detail-image">
        <img src={nft.image} alt={nft.name} fetchPriority="high" />
      </div>

      <section className="detail-content">
        <Link to="/" className="detail-back"><ArrowLeft size={17} aria-hidden="true" /> Voltar ao catálogo</Link>
        <p className="eyebrow">{nft.collection}</p>
        <h1>{nft.name}</h1>
        <FavoriteButton nftId={nft.id} label={nft.name} />
        <p>{nft.description}</p>

        <div className="detail-meta">
          <span className="muted">Criado por</span>
          <strong>{nft.creator}</strong>
        </div>

        <div className="price-panel">
          <span className="muted">Preço por edição</span>
          <strong className="detail-price">{nft.priceEth} ETH</strong>
          <span className="muted">
            {nft.available} de {nft.edition} unidades disponíveis
          </span>
        </div>

        <Button
          disabled={nft.available <= 0 || addToCart.isPending}
          onClick={() => addToCart.mutate()}
        >
          {nft.available <= 0 ? 'Esgotado' : addToCart.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}
        </Button>
        {addToCart.isSuccess && <p role="status">NFT adicionado ao carrinho. <Link to="/cart" className="text-link">Ver carrinho</Link></p>}
        {addToCart.isError && <p role="alert">Não foi possível adicionar. Tente novamente.</p>}

        <p className="muted small">
          Compra simulada. Nenhuma transação blockchain é realizada.
        </p>
      </section>
    </main>
  )
}
