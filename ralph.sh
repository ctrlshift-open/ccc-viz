#!/bin/bash
# ralph.sh - Autonomous Claude loop

MAX_ITERATIONS=${1:-10}
PAUSE_SECONDS=3
PROMPT_FILE="prompt.md"
STOP_FLAG=".ralph-stop"
LOG_DIR=".ralph/logs"
LOG_FILE="$LOG_DIR/ralph-$(date +%Y-%m-%d-%H-%M).log"

# Setup
mkdir -p "$LOG_DIR"
rm -f "$STOP_FLAG"

log() {
    echo "$1" | tee -a "$LOG_FILE"
}

log "=== Ralph started $(date) ==="
log "Max iterations: $MAX_ITERATIONS"
log "Log file: $LOG_FILE"
log "Stop with: touch $STOP_FLAG"
log ""

for i in $(seq 1 $MAX_ITERATIONS); do
    log "=== Iteration $i/$MAX_ITERATIONS - $(date +%H:%M:%S) ==="

    # Check stop flag
    if [ -f "$STOP_FLAG" ]; then
        log "Stop flag detected. Exiting gracefully."
        rm -f "$STOP_FLAG"
        exit 0
    fi

    # Run Claude
    claude --dangerously-skip-permissions --print < "$PROMPT_FILE" 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
        log "Claude exited with code $EXIT_CODE"
    fi

    # Check for all tasks complete
    if grep -q "^ALL_TASKS_COMPLETE$" "$LOG_FILE" 2>/dev/null; then
        log "=== All tasks complete! ==="
        exit 0
    fi

    # Check single task complete
    if grep -q "TASK_COMPLETE" "$LOG_FILE" 2>/dev/null; then
        log "Task completed, continuing to next iteration..."
    fi

    log "=== Iteration $i complete, pausing ${PAUSE_SECONDS}s ==="
    sleep $PAUSE_SECONDS
done

log "=== Max iterations reached ==="
exit 1
