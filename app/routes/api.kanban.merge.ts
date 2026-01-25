import type { Route } from "./+types/api.kanban.merge";
import type { MergeCardsInput } from "~/types/kanban";

/**
 * POST: Merge two cards (combine sessionIds, delete source)
 */

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { getKanbanState, saveKanbanState, mergeCards } = await import(
    "~/utils/kanban.server"
  );

  try {
    const body = (await request.json()) as MergeCardsInput;

    if (!body.sourceId || !body.targetId) {
      return Response.json({ error: "sourceId and targetId required" }, { status: 400 });
    }

    if (body.sourceId === body.targetId) {
      return Response.json({ error: "Cannot merge card with itself" }, { status: 400 });
    }

    const state = await getKanbanState();

    // Verify both cards exist
    const sourceCard = state.cards.find((c) => c.id === body.sourceId);
    const targetCard = state.cards.find((c) => c.id === body.targetId);

    if (!sourceCard) {
      return Response.json({ error: "Source card not found" }, { status: 404 });
    }
    if (!targetCard) {
      return Response.json({ error: "Target card not found" }, { status: 404 });
    }

    const updatedState = mergeCards(state, body.sourceId, body.targetId);
    await saveKanbanState(updatedState);

    // Return the merged card
    const mergedCard = updatedState.cards.find((c) => c.id === body.targetId);
    return Response.json(mergedCard);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to merge cards" },
      { status: 400 }
    );
  }
}
