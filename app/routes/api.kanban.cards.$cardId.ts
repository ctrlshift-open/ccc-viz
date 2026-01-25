import type { Route } from "./+types/api.kanban.cards.$cardId";
import type { KanbanStatus, UpdateCardInput } from "~/types/kanban";
import { KANBAN_COLUMNS } from "~/types/kanban";

/**
 * PATCH: Update card status/order/title
 */

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { cardId } = params;
  if (!cardId) {
    return Response.json({ error: "Card ID required" }, { status: 400 });
  }

  const { getKanbanState, saveKanbanState, updateCardStatus } = await import(
    "~/utils/kanban.server"
  );

  try {
    const body = (await request.json()) as Partial<UpdateCardInput>;
    const state = await getKanbanState();

    // Find the card
    const cardIndex = state.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      return Response.json({ error: "Card not found" }, { status: 404 });
    }

    let updatedState = state;

    // Handle status/order change
    if (body.status !== undefined || body.order !== undefined) {
      const newStatus = body.status as KanbanStatus | undefined;

      // Validate status if provided
      if (newStatus && !KANBAN_COLUMNS.includes(newStatus)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }

      updatedState = updateCardStatus(
        state,
        cardId,
        newStatus ?? state.cards[cardIndex].status,
        body.order
      );
    }

    // Handle title change
    if (body.title !== undefined) {
      updatedState = {
        ...updatedState,
        cards: updatedState.cards.map((c) =>
          c.id === cardId ? { ...c, title: body.title!, updatedAt: new Date().toISOString() } : c
        ),
      };
    }

    await saveKanbanState(updatedState);
    const updatedCard = updatedState.cards.find((c) => c.id === cardId);
    return Response.json(updatedCard);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update card" },
      { status: 400 }
    );
  }
}
