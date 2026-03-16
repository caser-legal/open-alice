#!/bin/bash
# OpenAlice Stop Script

echo "Stopping OpenAlice..."

# Kill the main process
pkill -f "tsx src/main.ts" 2>/dev/null
pkill -f "node dist/main.js" 2>/dev/null

# Kill any processes on our ports
for port in 3002 3005 6901; do
    lsof -ti:$port | xargs kill -9 2>/dev/null
done

echo "✓ OpenAlice stopped"
echo ""
echo "To start again, run: as"
