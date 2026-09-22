/**
 * Polymarket Integration — Prediction Market Data & Trading Tools
 *
 * Fetches real-time market data from Polymarket prediction markets.
 * Supports crypto markets with 5min and 15min interval analysis for arbitrage.
 */

export { createPolymarketTools } from './adapter.js'
export type { PolymarketMarket, PolymarketPrice, PolymarketOrder } from './types.js'
