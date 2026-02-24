---
# ccc-viz-dsfh
title: Auto-navigate to new session after creation
status: completed
type: bug
priority: normal
created_at: 2026-02-21T14:57:48Z
updated_at: 2026-02-21T14:58:53Z
---

startNewSession waits for full CLI completion before redirect fires. Fix: resolve immediately after spawn, let SSE handle live updates on session page.