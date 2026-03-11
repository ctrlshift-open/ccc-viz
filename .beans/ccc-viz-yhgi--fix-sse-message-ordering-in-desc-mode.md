---
# ccc-viz-yhgi
title: Fix SSE message ordering in desc mode
status: completed
type: bug
priority: normal
created_at: 2026-02-21T14:54:20Z
updated_at: 2026-02-21T14:54:30Z
---

New messages from SSE stream arrive in ascending line order but are prepended as-is in desc mode, causing human message to appear above assistant response. Fix: reverse newOnes before prepending in desc mode.