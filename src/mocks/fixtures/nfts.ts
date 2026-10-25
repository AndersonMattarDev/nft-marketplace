
import type { NFT } from '../../types/nft'

export const nfts: NFT[] = [
  {
    id: 'cosmic-001',
    name: 'Emerald Ape #042',
    collection: 'Emerald Club',
    description: 'Uma edição colecionável do clube Emerald.',
    image: '/nft-art/emerald-ape.jpg',
    priceEth: '1.19',
    available: 8,
    edition: 10,
    creator: 'Nova Studio',
    category: 'Art',
    createdAt: '2026-10-01T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'pixel-002',
    name: 'Sage Nomad #009',
    collection: 'Nomad Stories',
    description: 'Um retrato raro de um viajante digital.',
    image: '/nft-art/sage-nomad.jpg',
    priceEth: '1.69',
    available: 12,
    edition: 20,
    creator: 'Pixel Lab',
    category: 'Gaming',
    createdAt: '2026-09-30T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'neon-003',
    name: 'Neon Vessel #552',
    collection: 'Digital Visions',
    description: 'Formas e luzes neon em uma paisagem digital futurista.',
    image: '/nft-art/neon-vessel.jpg',
    priceEth: '1.99',
    salePriceEth: '2.29',
    available: 4,
    edition: 5,
    creator: 'Neon Works',
    category: 'Art',
    createdAt: '2026-09-29T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'earth-004',
    name: 'Cosmic Bloom #118',
    collection: 'Cosmic Worlds',
    description: 'Uma obra da coleção Cosmic Worlds.',
    image: '/nft-art/sage-nomad.jpg',
    priceEth: '1.29',
    available: 6,
    edition: 8,
    creator: 'Orbit Collective',
    category: 'Art',
    createdAt: '2026-09-28T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'abstract-005',
    name: 'Violet Nomad #314',
    collection: 'Nomad Stories',
    description: 'Uma exploração abstrata de cores, reflexos e geometria.',
    image: '/nft-art/sage-nomad.jpg',
    priceEth: '1.39',
    available: 15,
    edition: 25,
    creator: 'Forma Studio',
    category: 'Collectibles',
    createdAt: '2026-09-27T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'galaxy-006',
    name: 'Ivory Baron #088',
    collection: 'Ivory Society',
    description: 'Um colecionável singular da Ivory Society.',
    image: '/nft-art/ivory-baron.jpg',
    priceEth: '1.79',
    available: 3,
    edition: 5,
    creator: 'Nova Studio',
    category: 'Art',
    createdAt: '2026-09-26T10:00:00.000Z',
    version: 1,
  },
]

nfts.push(
  { ...nfts[4], id: 'golden-beat-207', name: 'Golden Beat #207', collection: 'Golden Club', image: '/nft-art/golden-beat.jpg', priceEth: '0.99', salePriceEth: undefined, createdAt: '2026-09-25T10:00:00.000Z' },
  { ...nfts[0], id: 'golden-groove-021', name: 'Golden Groove #021', collection: 'Golden Club', image: '/nft-art/golden-beat.jpg', priceEth: '0.79', salePriceEth: undefined, createdAt: '2026-09-24T10:00:00.000Z' },
  { ...nfts[4], id: 'golden-signal-160', name: 'Golden Signal #160', collection: 'Golden Club', image: '/nft-art/golden-beat.jpg', priceEth: '0.39', salePriceEth: undefined, createdAt: '2026-09-23T10:00:00.000Z' },
)

// Enough deterministic fixture records to exercise catalog pagination and sorting.
nfts.push(...Array.from({ length: 21 }, (_, index) => {
  const source = nfts[index % 9]
  return {
    ...source,
    id: `edition-${String(index + 1).padStart(3, '0')}`,
    name: `${source.name} · Edition ${String(index + 1).padStart(2, '0')}`,
    priceEth: (0.15 + ((index * 17) % 120) / 100).toFixed(2),
    available: 2 + (index % 12),
    edition: 5 + (index % 20),
    createdAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    version: 1,
    network: (['Ethereum', 'Polygon', 'Solana'] as const)[index % 3],
  }
}))

export const resetNFTFixtures = () => structuredClone(nfts)
