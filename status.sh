#!/bin/bash
# OpenAlice Status Script

echo "OpenAlice Status:"
echo ""

check_port() {
    local port=$1
    local name=$2
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "  ✓ $name (port $port): RUNNING"
    else
        echo "  ✗ $name (port $port): STOPPED"
    fi
}

check_port 3002 "Web UI"
check_port 6901 "OpenBB API"

echo ""
echo "Logs: tail -f /tmp/openalice.log"
