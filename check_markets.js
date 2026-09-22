/**
 * Simple script to check for Polymarket arbitrage opportunities
 */

import { createPolymarketTools } from './src/extension/polymarket/adapter.ts';
import { PolymarketClient } from './src/extension/polymarket/client.ts';

async function checkMarkets() {
  console.log('Checking Polymarket markets for arbitrage opportunities...');

  try {
    const client = new PolymarketClient();

    // Get active markets
    const markets = await client.getMarkets({ limit: 20 });
    console.log(`\nFound ${markets.length} active markets`);

    // Check each market for arbitrage opportunities
    for (const market of markets.slice(0, 5)) { // Check first 5 markets
      console.log(`\nMarket: ${market.question}`);
      console.log(`Price: ${market.price}`);

      try {
        const orderBook = await client.getOrderBook(market.id);
        if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
          const bestBid = orderBook.bids[0].price;
          const bestAsk = orderBook.asks[0].price;
          const spread = ((bestBid - bestAsk) / bestAsk * 100).toFixed(2);

          console.log(`Best Bid: ${bestBid} (${orderBook.bids[0].size})`);
          console.log(`Best Ask: ${bestAsk} (${orderBook.asks[0].size})`);
          console.log(`Spread: ${spread}%`);

          if (parseFloat(spread) >= 2) {
            console.log(`\n*** ARBITRAGE OPPORTUNITY FOUND! ***`);
            console.log(`Spread: ${spread}%`);
            console.log(`Expected return: ~${spread}%`);
            console.log(`Recommended action: BUY YES at ${bestAsk} and SELL NO at ${bestBid}`);
          }
        }
      } catch (err) {
        console.log(`Error getting order book: ${err.message}`);
      }
    }

    // Also check for general arbitrage opportunities
    console.log('\nChecking for general arbitrage opportunities...');
    const opportunities = await client.findArbitrageOpportunities(2);
    console.log(`Found ${opportunities.length} opportunities with >2% spread`);

    if (opportunities.length > 0) {
      console.log('\nTop opportunities:');
      opportunities.slice(0, 3).forEach((opp, i) => {
        console.log(`${i + 1}. ${opp.market.question}`);
        console.log(`   Spread: ${opp.spread}%`);
        console.log(`   Token ID: ${opp.tokenId}`);
      });
    }

  } catch (error) {
    console.error('Error checking markets:', error);
  }
}

checkMarkets();