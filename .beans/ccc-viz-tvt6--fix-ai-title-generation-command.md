---
# ccc-viz-tvt6
title: Fix AI title generation command
status: completed
type: bug
priority: normal
created_at: 2026-01-26T02:33:52Z
updated_at: 2026-01-26T02:34:25Z
---

The generateAITitle() function fails because Claude CLI returns verbose multi-line output. Fix: add --system-prompt to enforce single-line output.