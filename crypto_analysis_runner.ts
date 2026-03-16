/**
 * Cryptocurrency Chart Analysis Script
 * Analyzes 5m and 15m charts for BTC/ETH/XRP/SOL/DOGE
 * Stages trades if strong signals are detected
 */

import { SDKCryptoClient } from './src/openbb/sdk/crypto-client.js'
import { IndicatorCalculator } from './src/extension/analysis-kit/indicator/calculator.js'
import type { IndicatorContext, OhlcvData } from './src/extension/analysis-kit/indicator/types.js'
import { AccountManager } from './src/extension/trading/account-manager.js'
import { TradingGit } from './src/extension/trading/git/TradingGit.js'
import { createTradingTools } from './src/extension/trading/adapter.js'
import { wireAccountTrading } from './src/extension/trading/factory.js'
import { createGuardPipeline } from './src/extension/trading/guards/guard-pipeline.js'
import { createCcxtProviderTools } from './src/extension/trading/providers/ccxt/index.js'
import { CcxtPlatform } from './src/extension/trading/providers/ccxt/CcxtPlatform.js'

const SYMBOLS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE']
const INTERVALS = ['5m', '15m']

interface SignalStrength {
  symbol: string
  interval: string
  rsi: number
  macdSignal: 'bullish' | 'bearish' | 'neutral'
  trend: 'uptrend' | 'downtrend' | 'sideways'
  strength: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  reasoning: string
}

async function main() {
  console.log('🚀 Starting cryptocurrency chart analysis...\n')

  // Initialize crypto client
  const cryptoClient = new SDKCryptoClient()

  // Create analysis context
  const context: IndicatorContext = {
    getHistoricalData: async (symbol, interval) => {
      const start_date = new Date()
      start_date.setDate(start_date.getDate() - 7) // Get 7 days of data

      const results = await cryptoClient.getHistorical({
        symbol: `${symbol}USD`,
        start_date: start_date.toISOString().slice(0, 10),
        interval
      }) as OhlcvData[]

      results.sort((a, b) => a.date.localeCompare(b.date))
      return results
    },
  }

  const calculator = new IndicatorCalculator(context)
  const signals: SignalStrength[] = []

  // Analyze each symbol on each interval
  for (const symbol of SYMBOLS) {
    for (const interval of INTERVALS) {
      console.log(`📊 Analyzing ${symbol}/${interval}...`)

      try {
        // Get current price
        const currentPriceFormula = `CLOSE('${symbol}USD', '${interval}')[-1]`
        const currentPrice = await calculator.calculate(currentPriceFormula, 2)

        // Calculate RSI (14 period)
        const rsiFormula = `RSI(CLOSE('${symbol}USD', '${interval}'), 14)`
        const rsi = await calculator.calculate(rsiFormula, 2)

        // Calculate MACD
        const macdFormula = `MACD(CLOSE('${symbol}USD', '${interval}'), 12, 26, 9)`
        const macd = await calculator.calculate(macdFormula, 4)

        // Calculate SMA(20) and SMA(50) for trend
        const sma20Formula = `SMA(CLOSE('${symbol}USD', '${interval}'), 20)`
        const sma20 = await calculator.calculate(sma20Formula, 2)

        const sma50Formula = `SMA(CLOSE('${symbol}USD', '${interval}'), 50)`
        const sma50 = await calculator.calculate(sma50Formula, 2)

        // Calculate Bollinger Bands
        const bbandsFormula = `BBANDS(CLOSE('${symbol}USD', '${interval}'), 20, 2)`
        const bbands = await calculator.calculate(bbandsFormula, 2)

        // Determine MACD signal
        const macdValue = macd.macd || 0
        const signalValue = macd.signal || 0
        const macdSignal = macdValue > signalValue ? 'bullish' : macdValue < signalValue ? 'bearish' : 'neutral'

        // Determine trend
        const trend = currentPrice > sma20 && sma20 > sma50 ? 'uptrend'
          : currentPrice < sma20 && sma20 < sma50 ? 'downtrend'
          : 'sideways'

        // Determine signal strength
        let strength: SignalStrength['strength'] = 'hold'
        let reasoning = ''

        // Strong buy: RSI < 30 (oversold) + bullish MACD + uptrend or price > lower BB
        if (rsi < 30 && macdSignal === 'bullish') {
          strength = 'strong_buy'
          reasoning = `RSI oversold (${rsi}), bullish MACD crossover, ${trend}`
        }
        // Buy: RSI < 40 + bullish MACD
        else if (rsi < 40 && macdSignal === 'bullish') {
          strength = 'buy'
          reasoning = `RSI low (${rsi}), bullish MACD, ${trend}`
        }
        // Strong sell: RSI > 70 (overbought) + bearish MACD + downtrend or price < upper BB
        else if (rsi > 70 && macdSignal === 'bearish') {
          strength = 'strong_sell'
          reasoning = `RSI overbought (${rsi}), bearish MACD crossover, ${trend}`
        }
        // Sell: RSI > 60 + bearish MACD
        else if (rsi > 60 && macdSignal === 'bearish') {
          strength = 'sell'
          reasoning = `RSI high (${rsi}), bearish MACD, ${trend}`
        }
        // Hold otherwise
        else {
          strength = 'hold'
          reasoning = `RSI neutral (${rsi}), ${macdSignal} MACD, ${trend}`
        }

        signals.push({
          symbol,
          interval,
          rsi,
          macdSignal,
          trend,
          strength,
          reasoning,
        })

        console.log(`   Price: $${currentPrice} | RSI: ${rsi} | MACD: ${macdSignal} | Trend: ${trend} | Signal: ${strength}`)

      } catch (error) {
        console.error(`   ❌ Error analyzing ${symbol}/${interval}:`, error)
      }
    }
  }

  console.log('\n📈 Analysis Summary:')
  console.log('='.repeat(80))

  // Find strong signals
  const strongSignals = signals.filter(s => s.strength === 'strong_buy' || s.strength === 'strong_sell')
  const moderateSignals = signals.filter(s => s.strength === 'buy' || s.strength === 'sell')

  console.log(`\n🔥 STRONG SIGNALS (${strongSignals.length}):`)
  for (const signal of strongSignals) {
    console.log(`   ${signal.strength === 'strong_buy' ? '🟢' : '🔴'} ${signal.symbol}/${signal.interval}: ${signal.strength.toUpperCase()} - ${signal.reasoning}`)
  }

  console.log(`\n📊 MODERATE SIGNALS (${moderateSignals.length}):`)
  for (const signal of moderateSignals) {
    console.log(`   ${signal.strength === 'buy' ? '🟢' : '🔴'} ${signal.symbol}/${signal.interval}: ${signal.strength.toUpperCase()} - ${signal.reasoning}`)
  }

  // Stage trades for strong signals only
  if (strongSignals.length > 0) {
    console.log('\n🎯 Staging trades for strong signals...')
    await stageTrades(strongSignals, cryptoClient)
  } else {
    console.log('\n⏸️  No strong signals detected - no trades staged')
  }

  return signals
}

async function stageTrades(signals: SignalStrength[], cryptoClient: SDKCryptoClient) {
  // Try to initialize trading infrastructure
  try {
    // Check if CCXT config exists
    const fs = await import('fs')
    const configPath = './data/config/trading.json'

    if (!fs.existsSync(configPath)) {
      console.log('⚠️  No trading configuration found at', configPath)
      console.log('📝 To enable trading, create a trading.json config with CCXT credentials')
      return
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (!config.ccxt || !config.ccxt.enabled) {
      console.log('⚠️  CCXT trading is not enabled in config')
      console.log('📝 Enable CCXT in trading.json to stage trades')
      return
    }

    // Initialize platform and account manager
    const platform = new CcxtPlatform({
      exchanges: config.ccxt.exchanges || ['bybit'],
    })

    const accountManager = new AccountManager()
    const gitInstances = new Map<string, TradingGit>()

    // Create CCXT account
    const accountId = 'ccxt-crypto'
    await accountManager.addAccount(accountId, platform, {
      exchange: config.ccxt.exchanges?.[0] || 'bybit',
      apiKey: config.ccxt.apiKey,
      apiSecret: config.ccxt.apiSecret,
      options: config.ccxt.options || {},
    })

    // Create TradingGit for this account
    const git = new TradingGit(accountId, {
      autoPush: false,
      guardPipeline: createGuardPipeline([]),
    })
    gitInstances.set(accountId, git)

    // Wire up account
    await wireAccountTrading(accountManager, accountId, git)

    // Create resolver
    const resolver = {
      accountManager,
      getGit: (id: string) => gitInstances.get(id),
      getGitState: async (id: string) => gitInstances.get(id)?.getState(),
    }

    const tradingTools = createTradingTools(resolver)

    // Stage trades for each strong signal
    for (const signal of signals) {
      const action = signal.strength === 'strong_buy' ? 'buy' : 'sell'
      const symbol = signal.symbol

      console.log(`\n📝 Staging ${action.toUpperCase()} order for ${symbol}...`)

      try {
        // Search for the contract first
        const searchResults = await tradingTools.searchContracts.execute({
          pattern: symbol,
          source: accountId,
        })

        if (!searchResults || (searchResults as any).error || (searchResults as any[]).length === 0) {
          console.log(`   ⚠️  Could not find contract for ${symbol}`)
          continue
        }

        const contract = Array.isArray(searchResults) ? searchResults[0] : searchResults
        const aliceId = contract.aliceId

        if (!aliceId) {
          console.log(`   ⚠️  No aliceId found for ${symbol}`)
          continue
        }

        // Get current quote for price reference
        const quote = await tradingTools.getQuote.execute({ aliceId, source: accountId })
        const currentPrice = quote?.last || quote?.bid || 0

        // Stage a small test order (0.1% of typical account, or fixed amount)
        const notional = 100 // $100 test position
        const type = 'market'

        const result = await tradingTools.placeOrder.execute({
          source: accountId,
          aliceId,
          symbol,
          side: action,
          type,
          notional,
        })

        console.log(`   ✅ Staged: ${action} ${symbol} ($${notional}) - ${JSON.stringify(result)}`)

      } catch (error: any) {
        console.log(`   ❌ Failed to stage ${symbol}: ${error.message}`)
      }
    }

    // Check status
    const status = await tradingTools.tradingStatus.execute({})
    console.log('\n📋 Trading Status:')
    console.log(JSON.stringify(status, null, 2))

    console.log('\n💡 To execute staged orders, run:')
    console.log('   tradingCommit({ message: "Technical analysis signals" })')
    console.log('   tradingPush()')

  } catch (error: any) {
    console.log('⚠️  Could not initialize trading:', error.message)
    console.log('📝 Configure trading credentials in data/config/trading.json to enable trade staging')
  }
}

main().catch(console.error)
