/**
 * Polymarket AI Tools Adapter
 *
 * Exposes Polymarket data as AI tools for trading analysis.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { PolymarketClient } from './client.js'

export function createPolymarketTools() {
  const client = new PolymarketClient()

  return {
    polymarketGetMarkets: tool({
      description: `Fetch active prediction markets from Polymarket.
Use this to discover trading opportunities in prediction markets.
Returns markets with question, price, volume, and liquidity data.`,
      inputSchema: z.object({
        tag: z.string().optional().describe('Filter by tag (e.g. "crypto", "trading", "defi")'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 50)'),
      }),
      execute: async ({ tag, limit }) => {
        const markets = await client.getMarkets({ tag, limit })
        return {
          markets: markets.map(m => ({
            id: m.condition_id,
            question: m.question,
            price: m.price ?? 'N/A',
            volume24h: m.volume_24h ?? 0,
            liquidity: m.liquidity ?? 0,
            active: m.active ?? false,
            tags: m.tags ?? [],
          })),
          count: markets.length,
        }
      },
    }),

    polymarketGetPriceHistory: tool({
      description: `Fetch price history for a specific Polymarket market.
Supports 5-minute and 15-minute intervals for short-term trading analysis.
Use this for technical analysis and trend identification.`,
      inputSchema: z.object({
        marketId: z.string().describe('Market condition ID'),
        interval: z.enum(['5m', '15m', '1h', '1d']).default('5m').describe('Time interval'),
      }),
      execute: async ({ marketId, interval }) => {
        try {
          const history = await client.getPriceHistory(marketId, interval)
          return {
            marketId,
            interval,
            dataPoints: history.length,
            history: history.slice(0, 100), // Limit for response size
          }
        } catch (err) {
          return {
            marketId,
            interval,
            error: err instanceof Error ? err.message : String(err),
            history: [],
          }
        }
      },
    }),

    polymarketGetOrderBook: tool({
      description: `Fetch the current order book for a Polymarket market.
Shows current bids (yes orders) and asks (no orders).
Use this to find arbitrage opportunities and assess market depth.`,
      inputSchema: z.object({
        tokenId: z.string().describe('Market token ID'),
      }),
      execute: async ({ tokenId }) => {
        try {
          const orderBook = await client.getOrderBook(tokenId)
          return {
            tokenId,
            bids: orderBook.bids.slice(0, 20), // Top 20 levels
            asks: orderBook.asks.slice(0, 20),
            spread: orderBook.bids[0] && orderBook.asks[0]
              ? ((orderBook.bids[0].price - orderBook.asks[0].price) / orderBook.asks[0].price * 100).toFixed(2)
              : 'N/A',
          }
        } catch (err) {
          return {
            tokenId,
            error: err instanceof Error ? err.message : String(err),
            bids: [],
            asks: [],
          }
        }
      },
    }),

    polymarketFindArbitrage: tool({
      description: `Scan Polymarket for arbitrage opportunities across markets.
Analyzes bid-ask spreads to identify profitable trading opportunities.
Returns markets sorted by expected return percentage.`,
      inputSchema: z.object({
        minSpread: z.number().min(0.1).max(50).default(2).describe('Minimum spread % (default: 2)'),
        limit: z.number().int().min(1).max(50).default(20).describe('Max opportunities to return'),
      }),
      execute: async ({ minSpread, limit }) => {
        const opportunities = await client.findArbitrageOpportunities(minSpread)
        return {
          opportunities: opportunities.slice(0, limit),
          totalFound: opportunities.length,
          minSpreadThreshold: minSpread,
        }
      },
    }),

    polymarketAnalyzeMarket: tool({
      description: `Comprehensive analysis of a Polymarket for trading strategy.
Fetches order book, recent trades, and calculates key metrics.
Use this to make informed trading decisions.`,
      inputSchema: z.object({
        marketId: z.string().describe('Market condition ID'),
        tokenId: z.string().describe('Market token ID'),
      }),
      execute: async ({ marketId, tokenId }) => {
        try {
          const [orderBook, trades] = await Promise.all([
            client.getOrderBook(tokenId),
            client.getTrades(tokenId, 50),
          ])

          const bestBid = orderBook.bids[0]?.price ?? 0
          const bestAsk = orderBook.asks[0]?.price ?? 0
          const spread = bestBid && bestAsk ? ((bestBid - bestAsk) / bestAsk * 100) : 0

          const totalVolume = trades.reduce((sum, t) => sum + (t.size || 0), 0)
          const avgPrice = trades.length > 0
            ? trades.reduce((sum, t) => sum + (t.price || 0), 0) / trades.length
            : 0

          return {
            marketId,
            tokenId,
            analysis: {
              currentPrice: (bestBid + bestAsk) / 2 || 0,
              bestBid,
              bestAsk,
              spread: spread.toFixed(2) + '%',
              liquidity: {
                bidDepth: orderBook.bids.reduce((sum, b) => sum + b.size, 0),
                askDepth: orderBook.asks.reduce((sum, a) => sum + a.size, 0),
              },
              volume: {
                recentTrades: trades.length,
                totalVolume,
                averagePrice: avgPrice.toFixed(4),
              },
              recommendation: spread > 2 ? 'ARBITRAGE_OPPORTUNITY' : spread < -2 ? 'SHORT_OPPORTUNITY' : 'HOLD',
            }
          }
        } catch (err) {
          return {
            marketId,
            tokenId,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      },
    }),
  }
}
