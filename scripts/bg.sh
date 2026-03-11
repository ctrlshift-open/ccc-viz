#!/usr/bin/env bash
set -euo pipefail

PORT=5174
PID_FILE=tmp/server.pid
LOG_FILE=tmp/output.log
DEV_CMD="pnpm dev"

is_running() {
  [ -f "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" >/dev/null 2>&1
}

case "${1:-help}" in
  up)
    mkdir -p tmp
    kill -9 "$(lsof -ti:"$PORT")" 2>/dev/null || true
    nohup $DEV_CMD > "$LOG_FILE" 2>&1 & echo $! > "$PID_FILE"
    echo "Started (PID: $!) → http://localhost:$PORT"
    ;;
  down)
    if is_running; then
      kill "$(cat "$PID_FILE")"
      echo "Stopped"
    else
      echo "Not running"
    fi
    ;;
  status)
    if is_running; then
      echo "Running (PID: $(cat "$PID_FILE")) → http://localhost:$PORT"
    else
      echo "Not running (port $PORT)"
    fi
    ;;
  logs)
    tail -50 "$LOG_FILE"
    ;;
  logs-watch)
    tail -f "$LOG_FILE"
    ;;
  restart)
    "$0" down
    sleep 2
    "$0" up
    ;;
  logs:clear)
    truncate -s 0 "$LOG_FILE" 2>/dev/null || true
    echo "Logs cleared"
    ;;
  clean)
    rm -rf tmp/
    echo "Cleaned tmp/"
    ;;
  *)
    echo "Usage: $0 {up|down|status|logs|logs-watch|logs:clear|restart|clean}"
    ;;
esac
