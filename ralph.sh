#!/bin/bash
# ralph.sh - Autonomous Claude loop

MAX_ITERATIONS=${1:-10}
PAUSE_SECONDS=3
PROMPT_FILE="prompt.md"
STOP_FLAG=".ralph-stop"
LOG_DIR=".ralph/logs"
LOG_FILE="$LOG_DIR/ralph-$(date +%Y-%m-%d-%H-%M).log"
TMP_OUTPUT="$LOG_DIR/.tmp-output"
MAX_RETRIES=3

# Setup
mkdir -p "$LOG_DIR"
rm -f "$STOP_FLAG"

log() {
    echo "$1" | tee -a "$LOG_FILE"
}

is_transient_error() {
    grep -qE "No messages returned|rate limit|timeout|ECONNRESET|503|529" "$1" 2>/dev/null
}

run_claude_with_retry() {
    local attempt=1
    local backoff=5

    while [ $attempt -le $MAX_RETRIES ]; do
        claude --dangerously-skip-permissions --print < "$PROMPT_FILE" > "$TMP_OUTPUT" 2>&1
        local exit_code=$?

        cat "$TMP_OUTPUT" | tee -a "$LOG_FILE"

        if [ $exit_code -eq 0 ] && ! is_transient_error "$TMP_OUTPUT"; then
            return 0
        fi

        if is_transient_error "$TMP_OUTPUT"; then
            log "Transient error detected, retry $attempt/$MAX_RETRIES in ${backoff}s..."
            sleep $backoff
            backoff=$((backoff * 3))
            attempt=$((attempt + 1))
        else
            return $exit_code
        fi
    done

    log "Max retries exhausted"
    return 1
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

    # Run Claude with retry
    run_claude_with_retry
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
        log "Claude failed after retries, code $EXIT_CODE"
    fi

    # Check for all tasks complete
    if grep -q "^ALL_TASKS_COMPLETE$" "$LOG_FILE" 2>/dev/null; then
        log "=== All tasks complete! ==="
        rm -f "$TMP_OUTPUT"
        exit 0
    fi

    # Check single task complete
    if grep -q "TASK_COMPLETE" "$LOG_FILE" 2>/dev/null; then
        log "Task completed, continuing to next iteration..."
    fi

    log "=== Iteration $i complete, pausing ${PAUSE_SECONDS}s ==="
    sleep $PAUSE_SECONDS
done

rm -f "$TMP_OUTPUT"
log "=== Max iterations reached ==="
exit 1
