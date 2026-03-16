#!/bin/bash
# OpenAlice Start Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting OpenAlice..."
echo ""

# Check if already running
if lsof -ti:3002 > /dev/null 2>&1; then
    echo "OpenAlice is already running on port 3002"
    echo "Access it at: http://localhost:3002"
    exit 0
fi

# Start in background
nohup pnpm dev > /tmp/openalice.log 2>&1 &

# Wait for startup
echo "Waiting for services to start..."
for i in {1..30}; do
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo ""
        echo "✓ OpenAlice is ready!"
        echo ""
        echo "Web UI:    http://localhost:3002"
        echo "OpenBB:    http://localhost:6901"
        echo ""
        echo "Logs: tail -f /tmp/openalice.log"
        exit 0
    fi
    sleep 1
done

echo "Startup timed out. Check logs: cat /tmp/openalice.log"
exit 1
