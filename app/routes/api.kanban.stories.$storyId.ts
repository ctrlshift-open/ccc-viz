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

  const {
    getStoryById,
    updateStory,
    updateStoryStatusAndOrder,
  } = await import("~/db/queries.server");

  try {
    const body = (await request.json()) as Partial<UpdateStoryInput>;

    // Find the story
    const story = getStoryById(storyId);
    if (!story) {
      return Response.json({ error: "Story not found" }, { status: 404 });
    }

    // Handle status/order change
    if (body.status !== undefined || body.order !== undefined) {
      const newStatus = body.status as KanbanStatus | undefined;

      // Validate status if provided
      if (newStatus && !KANBAN_COLUMNS.includes(newStatus)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }

      updateStoryStatusAndOrder(
        storyId,
        newStatus ?? story.status,
        body.order
      );
    }

    // Handle title change
    if (body.title !== undefined) {
      updateStory(storyId, { title: body.title, updatedAt: new Date().toISOString() });
    }

    // Handle PR link change
    if (body.prLink !== undefined) {
      updateStory(storyId, { prLink: body.prLink, updatedAt: new Date().toISOString() });
    }

    const updatedStory = getStoryById(storyId);
    return Response.json(updatedStory);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update story" },
      { status: 400 }
    );
  }
}
