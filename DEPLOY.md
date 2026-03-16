# Open Alice Deployment Guide

This guide walks you through deploying Open Alice on a fresh VPC or server instance.

## Prerequisites

- **Node.js** v20+ and **pnpm** v10+
- **Git** for cloning the repository
- API credentials for your trading platforms (Alpaca, exchanges)
- Access to a Claude Code backend or Anthropic API

---

## Quick Start (5 Minutes)

### Step 1: Clone Repository

```bash
git clone https://github.com/caser-legal/open-alice.git
cd open-alice
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```bash
# Required: Claude Code API
ANTHROPIC_AUTH_TOKEN=your-claude-code-token-here

# Required: Alpaca Trading (paper or live)
ALPACA_API_KEY=your-alpaca-api-key-here
ALPACA_API_SECRET=your-alpaca-api-secret-here

# Optional: Market data providers
OPENBB_FMP_API_KEY=your-fmp-api-key-here
```

### Step 4: Initialize Configuration

Copy the configuration templates:

```bash
cp data/config/templates/*.json data/config/
```

### Step 5: Start Open Alice

```bash
pnpm dev
```

Open Alice will start on multiple ports:
- **Web UI**: http://localhost:3002
- **MCP Server**: http://localhost:3001/mcp
- **MCP Ask**: http://localhost:3003/mcp

---

## Detailed Configuration

### Environment Variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_BASE_URL` | Yes | Claude Code backend URL (default: `http://localhost:20128/v1`) |
| `ANTHROPIC_AUTH_TOKEN` | Yes | Your Claude Code API token |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | No | Model for complex tasks |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | No | Model for standard tasks |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | No | Model for simple tasks |
| `ALPACA_API_KEY` | Yes | Alpaca API key (paper or live) |
| `ALPACA_API_SECRET` | Yes | Alpaca API secret |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for notifications |
| `TELEGRAM_ALLOWED_CHAT_IDS` | No | Comma-separated chat IDs |

### Configuration Files (data/config/)

All configuration files are in `data/config/`. Templates are provided in `data/config/templates/`.

#### Core Configurations

| File | Purpose | Secrets? |
|------|---------|----------|
| `connectors.json` | Web/MCP/Telegram ports | No |
| `accounts.json` | Trading account credentials | **Yes** |
| `platforms.json` | Platform definitions (Alpaca, CCXT) | No |
| `ai-provider-manager.json` | AI provider settings | **Yes** (token) |
| `openbb.json` | Market data providers | Optional |
| `agent.json` | Agent behavior settings | No |
| `engine.json` | Engine pairs and intervals | No |
| `heartbeat.json` | Heartbeat schedule | No |

#### accounts.json Example

```json
[
  {
    "id": "alpaca-paper",
    "platformId": "alpaca-platform",
    "apiKey": "PKAJNLE2FCWYVWVF6ZNJQO6IFG",
    "apiSecret": "FHnPDn3ZkhZi72gaLKTFyLBnADhy8mnPjTdxcQyLJ9U",
    "guards": []
  },
  {
    "id": "alpaca-live",
    "platformId": "alpaca-platform",
    "apiKey": "YOUR_LIVE_KEY",
    "apiSecret": "YOUR_LIVE_SECRET",
    "guards": [
      {
        "type": "max-order-size",
        "options": { "maxNotional": 1000 }
      }
    ]
  }
]
```

#### ai-provider-manager.json Example

For Claude Code backend:

```json
{
  "backend": "claude-code",
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128/v1",
    "ANTHROPIC_AUTH_TOKEN": "sk-your-token-here",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "if/qwen3-235b-a22b-instruct",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "if/qwen3-235b-a22b-instruct",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "if/qwen3-235b-a22b-instruct"
  }
}
```

For direct Anthropic API:

```json
{
  "backend": "anthropic",
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
  }
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Open Alice Engine                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Web Plugin  │  │  MCP Plugin  │  │  MCP Ask     │       │
│  │  Port: 3002  │  │  Port: 3001  │  │  Port: 3003  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
│                  ┌────────▼────────┐                         │
│                  │   ToolCenter    │                         │
│                  │  (Tool Registry)│                         │
│                  └────────┬────────┘                         │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐       │
│  │ Trading Tools│  │ Brain Tools  │  │ Market Tools │       │
│  │ (Alpaca/CCXT)│  │ (Memory/State)│ │ (OpenBB)     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### MCP Servers

Open Alice runs **two separate MCP servers**:

| Server | Port | Purpose |
|--------|------|---------|
| **Main MCP** | 3001 | Exposes trading/analysis tools to external agents |
| **MCP Ask** | 3003 | Exposes conversation ability (`askWithSession` tool) |

The separation prevents circular calls - Alice's own AI provider cannot see the Ask connector tools.

---

## Production Deployment

### System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB+ for session history and logs
- **OS**: Linux (Ubuntu 22.04+, Debian 12+), macOS, Windows WSL2

### Running as a Service (systemd)

Create `/etc/systemd/system/open-alice.service`:

```ini
[Unit]
Description=Open Alice Trading Agent
After=network.target

[Service]
Type=simple
User=alice
WorkingDirectory=/opt/open-alice
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable open-alice
sudo systemctl start open-alice
sudo systemctl status open-alice
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY packages/ibkr/package.json ./packages/ibkr/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000 3001 3002 3003 6901

CMD ["pnpm", "start"]
```

Build and run:

```bash
docker build -t open-alice .
docker run -d \
  --name open-alice \
  -p 3001:3001 \
  -p 3002:3002 \
  -p 3003:3003 \
  -v open-alice-data:/app/data \
  --env-file .env \
  open-alice
```

---

## Security Considerations

### Secrets Management

1. **Never commit `.env`** - It's in `.gitignore` by default
2. **Use environment variables** in production instead of `.env` files
3. **Rotate credentials regularly** - especially API keys
4. **Use paper trading first** - Test thoroughly before live trading

### Network Security

- Bind to `127.0.0.1` for local-only access
- Use a reverse proxy (nginx, Caddy) for HTTPS
- Configure firewall rules to restrict access
- Consider VPN access for remote management

### Trading Guards

Configure risk guards in `accounts.json`:

```json
{
  "id": "alpaca-live",
  "platformId": "alpaca-platform",
  "apiKey": "...",
  "apiSecret": "...",
  "guards": [
    {
      "type": "max-order-size",
      "options": { "maxNotional": 1000 }
    },
    {
      "type": "max-daily-loss",
      "options": { "maxLossPercent": 2 }
    },
    {
      "type": "no-pattern-day-trading",
      "options": {}
    }
  ]
}
```

---

## Verification

### Check All Services

```bash
# Web UI
curl http://localhost:3002

# MCP Server
curl http://localhost:3001/mcp

# MCP Ask
curl http://localhost:3003/mcp
```

### Check Logs

```bash
# If running with systemd
journalctl -u open-alice -f

# If running directly
tail -f logs/*.log
```

### Test MCP Connection

Use an MCP client (like Claude Code) to connect:

```
mcp connect http://localhost:3001/mcp
```

List available tools:

```
mcp tools
```

Call a tool:

```
mcp call getQuote {"aliceId": "alpaca-BTC/USD"}
```

---

## Troubleshooting

### Common Issues

**Port already in use:**
```
Error: listen EADDRINUSE: address already in use :::3001
```
Solution: Change the port in `data/config/connectors.json` or stop the conflicting service.

**Claude Code connection failed:**
```
Error: Failed to connect to Claude Code backend
```
Solution: Verify `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` in `.env`.

**Alpaca authentication failed:**
```
Error: Invalid API credentials
```
Solution: Check `ALPACA_API_KEY` and `ALPACA_API_SECRET` in `data/config/accounts.json`.

**pnpm install fails:**
```
ERR_PNPM_UNSUPPORTED_ENGINE
```
Solution: Ensure Node.js v20+ and pnpm v10+ are installed.

---

## Next Steps

After deployment:

1. **Configure persona** - Edit `data/brain/persona.md` to customize Alice's personality
2. **Set up heartbeat** - Configure automated tasks in `data/config/heartbeat.json`
3. **Connect external agents** - Use the MCP server at port 3001
4. **Enable Telegram** - Set bot token in `.env` and enable in `connectors.json`
5. **Review guard rails** - Configure trading guards for risk management

---

## Support

- Documentation: `docs/` directory
- API Reference: https://traderalice.com/docs
- Issues: https://github.com/caser-legal/open-alice/issues
