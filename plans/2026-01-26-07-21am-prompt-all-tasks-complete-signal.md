# Modify prompt.md for ALL_TASKS_COMPLETE Signal

## Goal
Add instructions to `prompt.md` so Claude outputs `ALL_TASKS_COMPLETE` when no incomplete phase beans remain, allowing `ralph.sh` to exit gracefully.

## Changes to prompt.md

Add after step 5 (picking highest priority incomplete phase bean):

1. **Check for completion** - If no incomplete phase beans exist, output `ALL_TASKS_COMPLETE` on its own line and stop
2. **Signal task completion** - After completing a single task (step 12), output `TASK_COMPLETE`

## Implementation

Insert between steps 5 and 6:
```
5a. If no incomplete phase beans exist, output `ALL_TASKS_COMPLETE` and stop
```

Add to end:
```
15. Output `TASK_COMPLETE` when done with this iteration
```

## Files Modified
- `prompt.md`

## Verification
- Run `ralph.sh` with all phases complete → should exit with "All tasks complete!"
- Run with incomplete phases → should continue iterating
