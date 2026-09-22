export const ALPACA_CONFIG = {
  API_KEY: process.env.ALPACA_API_KEY || 'REDACTED',
  SECRET_KEY: process.env.ALPACA_SECRET_KEY || 'REDACTED',
  BASE_URL: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets/v2'
};
