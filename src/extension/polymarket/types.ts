/**
 * Polymarket Types
 */

export interface PolymarketMarket {
  id: string
  question: string
  description: string
  slug: string
  outcomeType: 'binary' | 'categorical' | 'scalar'
  endpoints: {
    price: string
    orderBook: string
    trades: string
  }
  active: boolean
  closed: boolean
  liquidity: number
  volume24h: number
  tags: string[]
  conditionId: string
}

export interface PolymarketPrice {
  marketId: string
  price: number // 0-100 for binary markets
  timestamp: number
  volume24h: number
  change24h: number
  spread: number
}

export interface PolymarketOrderBook {
  marketId: string
  bids: Array<{ price: number; size: number }>
  asks: Array<{ price: number; size: number }>
  timestamp: number
}

export interface PolymarketOrder {
  marketId: string
  side: 'yes' | 'no'
  price: number
  size: number
  orderId: string
  status: 'pending' | 'filled' | 'cancelled'
}

export interface PolymarketTrade {
  marketId: string
  side: 'yes' | 'no'
  price: number
  size: number
  timestamp: number
  txHash: string
}

export interface PolymarketConfig {
  /**
   * Polymarket GraphQL API endpoint
   * @default 'https://api.polymarket.com/query'
   */
  apiUrl?: string

  /**
   * Clob (Central Limit Order Book) API endpoint
   * @default 'https://clob.polymarket.com'
   */
  clobUrl?: string

  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeout?: number
}
