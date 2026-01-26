import type { Route } from "./+types/api.kanban.stories.$storyId";
import type { KanbanStatus, UpdateStoryInput } from "~/types/kanban";
import { KANBAN_COLUMNS } from "~/types/kanban";

/**
 * PATCH: Update story status/order/title/prLink
 */

export async function action({ request, params }: Route.ActionArgs) {
  const { storyId } = params;
  if (!storyId) {
    return Response.json({ error: "Story ID required" }, { status: 400 });
  }

  // PATCH: Update story
  if (request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { getKanbanState, saveKanbanState, updateStoryStatus, updateStoryTitle, updateStoryPRLink } = await import(
    "~/utils/kanban.server"
  );

  try {
    const body = (await request.json()) as Partial<UpdateStoryInput>;
    let state = await getKanbanState();

    // Find the story
    const storyIndex = state.stories.findIndex((s) => s.id === storyId);
    if (storyIndex === -1) {
      return Response.json({ error: "Story not found" }, { status: 404 });
    }

    // Handle status/order change
    if (body.status !== undefined || body.order !== undefined) {
      const newStatus = body.status as KanbanStatus | undefined;

      // Validate status if provided
      if (newStatus && !KANBAN_COLUMNS.includes(newStatus)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }

      state = updateStoryStatus(
        state,
        storyId,
        newStatus ?? state.stories[storyIndex].status,
        body.order
      );
    }

    // Handle title change
    if (body.title !== undefined) {
      state = updateStoryTitle(state, storyId, body.title);
    }

    // Handle PR link change
    if (body.prLink !== undefined) {
      state = updateStoryPRLink(state, storyId, body.prLink);
    }

    await saveKanbanState(state);
    const updatedStory = state.stories.find((s) => s.id === storyId);
    return Response.json(updatedStory);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update story" },
      { status: 400 }
    );
  }
}
