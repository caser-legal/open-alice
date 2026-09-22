/**
 * Contract resolution helpers for Alpaca.
 *
 * Pure functions parameterized by provider string.
 * Supports both stocks (STK) and crypto (CRYPTO).
 */

import type { Contract } from '../../contract.js'
import type { Order } from '../../interfaces.js'

/** Check if symbol is a crypto pair (contains /) */
export function isCryptoSymbol(symbol: string): boolean {
  return symbol.includes('/')
}

/** Normalize symbol - handle legacy format (BTCUSD -> BTC/USD) */
export function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase()
  // Already a pair
  if (upper.includes('/')) return upper
  
  // Legacy format: BTCUSD -> BTC/USD
  const quoteAssets = ['USD', 'USDT', 'USDC', 'BTC', 'ETH']
  for (const quote of quoteAssets) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, -quote.length)
      return `${base}/${quote}`
    }
  }
  return upper
}

/** Build a fully qualified Contract for an Alpaca ticker. */
export function makeContract(ticker: string, provider: string): Contract {
  const normalized = normalizeSymbol(ticker)
  const isCrypto = isCryptoSymbol(normalized)
  
  return {
    aliceId: `${provider}-${normalized}`,
    symbol: normalized,
    secType: isCrypto ? 'CRYPTO' : 'STK',
    exchange: isCrypto ? 'ALPACA' : 'SMART',
    currency: isCrypto ? normalized.split('/')[1] : 'USD',
  }
}

/** Extract native symbol from aliceId, or null if not ours. */
export function parseAliceId(aliceId: string, provider: string): string | null {
  const prefix = `${provider}-`
  if (!aliceId.startsWith(prefix)) return null
  return aliceId.slice(prefix.length)
}

/**
 * Resolve a Contract to an Alpaca ticker symbol.
 * Accepts: aliceId, or symbol (+ supports STK and CRYPTO).
 */
export function resolveSymbol(contract: Contract, provider: string): string | null {
  if (contract.aliceId) {
    return parseAliceId(contract.aliceId, provider)
  }
  if (contract.symbol) {
    // Accept both STK and CRYPTO
    if (contract.secType && contract.secType !== 'STK' && contract.secType !== 'CRYPTO') return null
    return normalizeSymbol(contract.symbol)
  }
  return null
}

export function mapAlpacaOrderStatus(alpacaStatus: string): Order['status'] {
  switch (alpacaStatus) {
    case 'filled':
      return 'filled'
    case 'new':
    case 'accepted':
    case 'pending_new':
    case 'accepted_for_bidding':
      return 'pending'
    case 'canceled':
    case 'expired':
    case 'replaced':
      return 'cancelled'
    case 'partially_filled':
      return 'partially_filled'
    case 'done_for_day':
    case 'suspended':
    case 'rejected':
      return 'rejected'
    default:
      return 'pending'
  }
}
