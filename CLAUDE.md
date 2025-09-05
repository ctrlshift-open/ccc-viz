# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-viz is a React Router 7 full-stack application for visualizing Claude Code sessions. It reads from `~/.claude/projects` to display project sessions with filtering and markdown rendering capabilities.

## Essential Commands

```bash
# Development
pnpm dev          # Start dev server at http://localhost:5174
pnpm typecheck    # Generate route types and run TypeScript checks

# Build & Production
pnpm build        # Build client/server bundles to build/
pnpm start        # Run production server

# Background process management (custom scripts)
pnpm bg:start     # Start dev server in background
pnpm bg:logs      # Watch logs in real-time
pnpm bg:stop      # Stop background server
```

## Architecture

### Technology Stack
- **React Router 7** with SSR enabled and file-based routing
- **React 19** with TypeScript
- **TailwindCSS v4** for styling
- **Vite 6** as build tool
- **pnpm** as package manager

### Key Directories
- `app/routes/` - File-based routes using flatRoutes configuration
- `app/welcome/` - Reusable UI components
- `build/` - Compiled output (client and server bundles)

### Routing Structure
Routes are defined in `app/routes.ts` using `@react-router/fs-routes`:
- `_index.tsx` - Home page listing Claude projects
- `$project.sessions._index.tsx` - Project sessions list
- `$project.sessions.$sessionId.tsx` - Session detail view with filtering

### Data Flow
1. Application reads Claude Code sessions from local filesystem (`~/.claude/projects`)
2. Sessions are parsed and displayed with routing parameters
3. Session details include message type filtering and markdown rendering

## Development Guidelines

### Adding New Routes
Create files in `app/routes/` following the naming convention:
- Use `$` prefix for dynamic segments (e.g., `$project.tsx`)
- Use `.` for nested routes (e.g., `$project.sessions.tsx`)
- Use `_index.tsx` for index routes

### TypeScript Path Alias
Use `~/` to import from the app directory:
```typescript
import { Component } from "~/welcome/component"
```

### Server Configuration
The Vite dev server is configured to:
- Run on port 5174
- Accept connections from Tailscale network hosts
- Bind to 0.0.0.0 for network accessibility

### Styling
TailwindCSS v4 is configured in `app/app.css`. The app uses:
- Inter font family from Google Fonts
- Dark mode support via CSS variables
- Mobile-responsive design patterns

## Session Data Structure

Sessions contain messages with various types documented in `docs/session-message-types.md`:
- `human` - User messages
- `assistant` - Claude responses
- `text` - Tool outputs
- `command` - Commands like /start, /init
- `environment_details` - System information
- `tool_response` - Tool execution results

## Important Notes

- No test framework is currently configured (add Vitest if needed)
- Docker support available via multi-stage Dockerfile
- tmux-urls.cfg contains URL shortcuts for quick browser access
- The app specifically visualizes Claude Code session data from the local filesystem