#!/bin/bash

# Kill any process using port 3101
PORT=${PORT:-3101}
echo "🔍 Checking for processes on port $PORT..."

# Kill all processes using the port (multiple attempts)
for i in {1..3}; do
  PID=$(lsof -ti:$PORT 2>/dev/null)
  if [ ! -z "$PID" ]; then
    echo "🔪 Killing process(es) $PID on port $PORT (attempt $i)..."
    kill -9 $PID 2>/dev/null
    sleep 0.5
  else
    break
  fi
done

# Wait a moment to ensure port is released
sleep 0.5

echo "🚀 Starting DA Agent backend..."
node --watch src/index.js

