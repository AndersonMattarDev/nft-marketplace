
export interface NFT {
  id: string
  name: string
  collection: string
  description: string
  image: string
  priceEth: string
  available: number
  edition: number
  creator: string
  category: 'Art' | 'Gaming' | 'Collectibles' | 'Photography'
  createdAt: string
  version: number
  network?: 'Ethereum' | 'Polygon' | 'Solana'
  salePriceEth?: string
}

export interface NFTListResponse {
  items: NFT[]
  total: number
  page: number
  pageSize: number
}
