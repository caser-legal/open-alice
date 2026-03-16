/**
 * Polymarket API Client
 *
 * Fetches prediction market data from Polymarket.
 * Uses CLOB API for order book data and GraphQL for market data.
 */

import { z } from 'zod'

export interface PolymarketClientOpts {
  apiUrl?: string
  clobUrl?: string
  timeout?: number
}

const DEFAULT_CONFIG = {
  apiUrl: 'https://api.polymarket.com/query',
  clobUrl: 'https://clob.polymarket.com',
  timeout: 10000,
}

/**
 * Polymarket CLOB Client
 * Fetches order book, price, and trade data.
 */
export class PolymarketClient {
  private readonly clobUrl: string
  private readonly timeout: number

  constructor(opts: PolymarketClientOpts = {}) {
    this.clobUrl = opts.clobUrl ?? DEFAULT_CONFIG.clobUrl
    this.timeout = opts.timeout ?? DEFAULT_CONFIG.timeout
  }

  /**
   * Fetch active markets with optional tag filtering
   */
  async getMarkets(opts: { tag?: string; limit?: number } = {}): Promise<any[]> {
    const params = new URLSearchParams()
    if (opts.tag) params.append('tag', opts.tag)
    params.append('closed', 'false')

    const response = await this.fetch('/markets', { params })
    const markets = await response.json()

    let results = Array.isArray(markets) ? markets : (markets.data ?? markets)

    if (opts.limit && results.length > opts.limit) {
      results = results.slice(0, opts.limit)
    }

    return results
  }

  /**
   * Fetch price history for a specific market
   */
  async getPriceHistory(marketId: string, interval: '5m' | '15m' | '1h' | '1d' = '5m'): Promise<any[]> {
    const params = new URLSearchParams()
    params.append('market', marketId)
    params.append('interval', interval)

    const response = await this.fetch(`/history/${marketId}`, { params })
    return response.json()
  }

  /**
   * Fetch current order book for a market
   */
  async getOrderBook(tokenId: string): Promise<{
    bids: Array<{ price: number; size: number }>
    asks: Array<{ price: number; size: number }>
  }> {
    const response = await this.fetch(`/orderbook?token_id=${tokenId}`)
    const data = await response.json()

    return {
      bids: data.bids?.map((b: any) => ({ price: parseFloat(b.price), size: parseFloat(b.size) })) ?? [],
      asks: data.asks?.map((a: any) => ({ price: parseFloat(a.price), size: parseFloat(a.size) })) ?? [],
    }
  }

  /**
   * Get recent trades for a market
   */
  async getTrades(tokenId: string, limit: number = 100): Promise<any[]> {
    const response = await this.fetch(`/history?token_id=${tokenId}&limit=${limit}`)
    return response.json()
  }

  /**
   * Fetch markets related to crypto/DeFi
   */
  async getCryptoMarkets(limit: number = 50): Promise<any[]> {
    const cryptoTags = ['crypto', 'bitcoin', 'ethereum', 'defi', 'trading']
    const allMarkets: any[] = []

    for (const tag of cryptoTags) {
      try {
        const markets = await this.getMarkets({ tag, limit: 20 })
        allMarkets.push(...markets)
      } catch (err) {
        console.warn(`Failed to fetch markets for tag "${tag}":`, err)
      }
    }

    // Deduplicate by ID
    const unique = Array.from(
      new Map(allMarkets.map(m => [m.condition_id, m])).values()
    )

    return unique.slice(0, limit)
  }

  /**
   * Analyze arbitrage opportunities across markets
   */
  async findArbitrageOpportunities(minSpread: number = 2): Promise<Array<{
    market: any
    bestBid: number
    bestAsk: number
    spread: number
    expectedReturn: number
  }>> {
    const markets = await this.getCryptoMarkets(100)
    const opportunities: any[] = []

    for (const market of markets) {
      if (!market.token_id || !market.active) continue

      try {
        const orderBook = await this.getOrderBook(market.token_id)
        if (orderBook.bids.length === 0 || orderBook.asks.length === 0) continue

        const bestBid = orderBook.bids[0].price
        const bestAsk = orderBook.asks[0].price
        const spread = ((bestBid - bestAsk) / bestAsk) * 100

        if (Math.abs(spread) >= minSpread) {
          opportunities.push({
            market: {
              id: market.condition_id,
              question: market.question,
              token_id: market.token_id,
            },
            bestBid,
            bestAsk,
            spread,
            expectedReturn: Math.abs(spread),
          })
        }
      } catch (err) {
        // Skip markets without order books
      }
    }

    return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn)
  }

  private async fetch(path: string, opts: { params?: URLSearchParams } = {}): Promise<Response> {
    const url = new URL(path, this.clobUrl)
    if (opts.params) {
      opts.params.forEach((v, k) => url.searchParams.append(k, v))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`)
      }

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
