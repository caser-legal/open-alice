import { createAnalysisTools } from './src/extension/analysis-kit/adapter.js';
import { createMarketSearchTools } from './src/extension/market/adapter.js';
import { createSymbolIndex } from './src/openbb/equity/symbol-index.js';
import { SDKCryptoClient, SDKCurrencyClient, SDKEquityClient, getSDKExecutor, buildRouteMap } from './src/openbb/sdk/index.js';
import { buildSDKCredentials } from './src/openbb/credential-map.js';
import { readConfig } from './src/core/config.js';

async function runAnalysis() {
  try {
    console.log('Initializing OpenAlice components...');

    // Read config
    const config = await readConfig();
    console.log('Config loaded');

    // Initialize SDK components
    const executor = getSDKExecutor();
    const routeMap = buildRouteMap();
    const credentials = buildSDKCredentials(config.openbb.providerKeys);

    // Create SDK clients
    const equityClient = new SDKEquityClient(executor, 'equity', config.openbb.providers.equity, credentials, routeMap);
    const cryptoClient = new SDKCryptoClient(executor, 'crypto', config.openbb.providers.crypto, credentials, routeMap);
    const currencyClient = new SDKCurrencyClient(executor, 'currency', config.openbb.providers.currency, credentials, routeMap);

    console.log('SDK clients created');

    // Create tools
    const analysisTools = createAnalysisTools(equityClient, cryptoClient, currencyClient);
    const marketSearchTools = createMarketSearchTools(
      createSymbolIndex(),
      cryptoClient,
      currencyClient
    );

    console.log('Tools created');

    // Search for cryptocurrency symbols
    const cryptos = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE'];
    const results = {};

    for (const crypto of cryptos) {
      console.log(`\nSearching for ${crypto}...`);
      try {
        const searchResult = await marketSearchTools.marketSearchForResearch.execute({
          query: crypto
        });
        console.log(`${crypto} search results:`, searchResult);

        if (searchResult.results && searchResult.results.length > 0) {
          // Get the first matching crypto symbol
          const symbol = searchResult.results.find(r => r.assetClass === 'crypto');
          if (symbol) {
            console.log(`Found crypto symbol for ${crypto}:`, symbol);
            results[crypto] = symbol.symbol || symbol.name;
          }
        }
      } catch (error) {
        console.error(`Error searching for ${crypto}:`, error.message);
      }
    }

    console.log('\nIdentified crypto symbols:', results);

    // Analyze each cryptocurrency for 5m and 15m intervals
    const intervals = ['5m', '15m'];

    for (const [name, symbol] of Object.entries(results)) {
      if (!symbol) continue;

      for (const interval of intervals) {
        console.log(`\nAnalyzing ${name} (${symbol}) on ${interval} timeframe...`);

        try {
          // Get current price (last value)
          const currentPriceResult = await analysisTools.calculateIndicator.execute({
            asset: 'crypto',
            formula: `CLOSE('${symbol}', '${interval}')[-1]`,
            precision: 4
          });

          console.log(`${name} ${interval} current price:`, currentPriceResult);

          // Calculate RSI
          const rsiResult = await analysisTools.calculateIndicator.execute({
            asset: 'crypto',
            formula: `RSI(CLOSE('${symbol}', '${interval}'), 14)`,
            precision: 2
          });

          console.log(`${name} ${interval} RSI:`, rsiResult);

          // Calculate SMA (20-period)
          const smaResult = await analysisTools.calculateIndicator.execute({
            asset: 'crypto',
            formula: `SMA(CLOSE('${symbol}', '${interval}'), 20)`,
            precision: 4
          });

          console.log(`${name} ${interval} SMA(20):`, smaResult);

          // Calculate EMA (10-period)
          const emaResult = await analysisTools.calculateIndicator.execute({
            asset: 'crypto',
            formula: `EMA(CLOSE('${symbol}', '${interval}'), 10)`,
            precision: 4
          });

          console.log(`${name} ${interval} EMA(10):`, emaResult);

          // Check for trading signals
          if (currentPriceResult && rsiResult && smaResult && emaResult) {
            const currentPrice = Array.isArray(currentPriceResult) ? currentPriceResult[currentPriceResult.length - 1] : currentPriceResult;
            const rsiValue = Array.isArray(rsiResult) ? rsiResult[rsiResult.length - 1] : rsiResult;
            const smaValue = Array.isArray(smaResult) ? smaResult[smaResult.length - 1] : smaResult;
            const emaValue = Array.isArray(emaResult) ? emaResult[emaResult.length - 1] : emaResult;

            if (typeof currentPrice === 'number' && typeof rsiValue === 'number') {
              console.log(`\n${name} ${interval} Analysis:`);
              console.log(`  Price: $${currentPrice}`);
              console.log(`  RSI: ${rsiValue} (${rsiValue < 30 ? 'Oversold' : rsiValue > 70 ? 'Overbought' : 'Neutral'})`);
              console.log(`  SMA(20): $${smaValue}`);
              console.log(`  EMA(10): $${emaValue}`);

              // Generate trading signals
              let signals = [];

              // RSI signals
              if (rsiValue < 30) {
                signals.push('RSI Oversold - Potential Buy Signal');
              } else if (rsiValue > 70) {
                signals.push('RSI Overbought - Potential Sell Signal');
              }

              // Price vs SMA signals
              if (typeof currentPrice === 'number' && typeof smaValue === 'number') {
                if (currentPrice > smaValue && emaValue > smaValue) {
                  signals.push('Price Above SMA and EMA - Bullish');
                } else if (currentPrice < smaValue && emaValue < smaValue) {
                  signals.push('Price Below SMA and EMA - Bearish');
                }
              }

              console.log(`  Signals: ${signals.length > 0 ? signals.join(', ') : 'No strong signals'}`);
            }
          }
        } catch (error) {
          console.error(`Error analyzing ${name} on ${interval}:`, error.message);
        }
      }
    }

    console.log('\nAnalysis complete.');
  } catch (error) {
    console.error('Error in analysis:', error);
    console.error(error.stack);
  }
}

runAnalysis();