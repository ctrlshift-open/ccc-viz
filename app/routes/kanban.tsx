import type { Route } from "./+types/kanban";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { KanbanBoard } from "~/components/KanbanBoard";
import type { KanbanStatus } from "~/types/kanban";
import { useCallback } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Kanban Board - CC Viz" },
    { name: "description", content: "Organize Claude Code sessions" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  // Dynamic imports for server modules
  const { syncSessionsToCards } = await import("~/utils/kanban.server");
  const { getProjects } = await import("~/projects.server");

  // Sync sessions and get state
  const state = await syncSessionsToCards();
  const { projects } = await getProjects();

  return {
    state,
    projects: projects.map((p) => p.name),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "move") {
    const cardId = formData.get("cardId");
    const newStatus = formData.get("status");

    if (typeof cardId !== "string" || typeof newStatus !== "string") {
      return { error: "Invalid move request" };
    }

    const { getKanbanState, saveKanbanState, updateCardStatus } = await import(
      "~/utils/kanban.server"
    );

    const state = await getKanbanState();
    const updatedState = updateCardStatus(state, cardId, newStatus as KanbanStatus);
    await saveKanbanState(updatedState);

    return { success: true };
  }

  if (intent === "updateTitle") {
    const cardId = formData.get("cardId");
    const title = formData.get("title");

    if (typeof cardId !== "string" || typeof title !== "string") {
      return { error: "Invalid title update request" };
    }

    const { getKanbanState, saveKanbanState } = await import("~/utils/kanban.server");

    const state = await getKanbanState();
    const updatedState = {
      ...state,
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, title, updatedAt: new Date().toISOString() } : c
      ),
    };
    await saveKanbanState(updatedState);

    return { success: true };
  }

  if (intent === "merge") {
    const sourceId = formData.get("sourceId");
    const targetId = formData.get("targetId");

    if (typeof sourceId !== "string" || typeof targetId !== "string") {
      return { error: "Invalid merge request" };
    }

    const { getKanbanState, saveKanbanState, mergeCards } = await import("~/utils/kanban.server");

    const state = await getKanbanState();
    const updatedState = mergeCards(state, sourceId, targetId);
    await saveKanbanState(updatedState);

    return { success: true };
  }

  return { error: "Unknown intent" };
}

export default function Kanban() {
  const { state, projects } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const handleCardMove = (cardId: string, newStatus: KanbanStatus) => {
    fetcher.submit(
      { intent: "move", cardId, status: newStatus },
      { method: "post" }
    );
  };

  const handleTitleChange = (cardId: string, newTitle: string) => {
    fetcher.submit(
      { intent: "updateTitle", cardId, title: newTitle },
      { method: "post" }
    );
  };

  const handleTitleRegenerate = useCallback(async (cardId: string) => {
    const response = await fetch(`/api/kanban/cards/${cardId}`, {
      method: "POST",
    });
    if (response.ok) {
      revalidator.revalidate();
    }
  }, [revalidator]);

  const handleMerge = (sourceId: string, targetId: string) => {
    fetcher.submit(
      { intent: "merge", sourceId, targetId },
      { method: "post" }
    );
  };

  return (
    <main className="p-4 pt-16 md:pt-4 h-screen flex flex-col">
      <h1 className="text-xl font-semibold mb-4">Kanban Board</h1>
      <div className="flex-1 min-h-0">
        <KanbanBoard
          state={state}
          projects={projects}
          onCardMove={handleCardMove}
          onTitleChange={handleTitleChange}
          onTitleRegenerate={handleTitleRegenerate}
          onMerge={handleMerge}
        />
      </div>
    </main>
  );
}
