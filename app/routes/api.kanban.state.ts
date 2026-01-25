import type { Route } from "./+types/api.kanban.state";

/**
 * GET: Return current kanban state (syncs sessions first)
 * POST: Update entire kanban state
 */

export async function loader({}: Route.LoaderArgs) {
  const { syncSessionsToCards } = await import("~/utils/kanban.server");
  const state = await syncSessionsToCards();
  return Response.json(state);
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { getKanbanState, saveKanbanState } = await import("~/utils/kanban.server");

  try {
    const body = await request.json();

    // Validate body has cards array
    if (!body || !Array.isArray(body.cards)) {
      return Response.json({ error: "Invalid state: missing cards array" }, { status: 400 });
    }

    const currentState = await getKanbanState();

    // Merge: preserve importedSessionIds, update cards
    const updatedState = {
      ...currentState,
      cards: body.cards,
      lastSyncedAt: new Date().toISOString(),
    };

    await saveKanbanState(updatedState);
    return Response.json(updatedState);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update state" },
      { status: 400 }
    );
  }
}
