import type { Route } from "./+types/api.kanban.state";

/**
 * GET: Return current kanban state (no auto-sync)
 * POST: Update entire kanban state
 */

export async function loader({}: Route.LoaderArgs) {
  const { getKanbanState } = await import("~/utils/kanban.server");
  const state = getKanbanState();
  return Response.json(state);
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { saveKanbanStateToDb, getKanbanStateFromDb } = await import("~/db/queries.server");

  try {
    const body = await request.json();

    // Validate body has stories array
    if (!body || !Array.isArray(body.stories)) {
      return Response.json({ error: "Invalid state: missing stories array" }, { status: 400 });
    }

    // Full state replace via DB
    const updatedState = {
      version: 2 as const,
      stories: body.stories,
      lastSyncedAt: new Date().toISOString(),
    };

    saveKanbanStateToDb(updatedState);
    return Response.json(getKanbanStateFromDb());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update state" },
      { status: 400 }
    );
  }
}
