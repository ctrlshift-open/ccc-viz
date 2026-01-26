import type { Route } from "./+types/kanban";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { KanbanBoard } from "~/components/KanbanBoard";
import type { KanbanStatus } from "~/types/kanban";
import { useCallback, useEffect } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Kanban Board - CC Viz" },
    { name: "description", content: "Organize Claude Code sessions" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  // Dynamic imports for server modules
  const { getKanbanState } = await import("~/utils/kanban.server");
  const { getProjects } = await import("~/projects.server");

  // Just read state - no auto-sync
  const state = await getKanbanState();
  const { projects } = await getProjects();

  return {
    state,
    projects: projects.map((p) => p.name),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync") {
    const { syncSessionsToStories } = await import("~/utils/kanban.server");
    const result = await syncSessionsToStories();
    return { success: true, ...result };
  }

  if (intent === "move") {
    const storyId = formData.get("storyId");
    const newStatus = formData.get("status");

    if (typeof storyId !== "string" || typeof newStatus !== "string") {
      return { error: "Invalid move request" };
    }

    const { getKanbanState, saveKanbanState, updateStoryStatus } = await import(
      "~/utils/kanban.server"
    );

    const state = await getKanbanState();
    const updatedState = updateStoryStatus(state, storyId, newStatus as KanbanStatus);
    await saveKanbanState(updatedState);

    return { success: true };
  }

  if (intent === "updateTitle") {
    const storyId = formData.get("storyId");
    const title = formData.get("title");

    if (typeof storyId !== "string" || typeof title !== "string") {
      return { error: "Invalid title update request" };
    }

    const { getKanbanState, saveKanbanState, updateStoryTitle } = await import("~/utils/kanban.server");

    const state = await getKanbanState();
    const updatedState = updateStoryTitle(state, storyId, title);
    await saveKanbanState(updatedState);

    return { success: true };
  }

  if (intent === "updatePRLink") {
    const storyId = formData.get("storyId");
    const prLink = formData.get("prLink");

    if (typeof storyId !== "string") {
      return { error: "Invalid PR link update request" };
    }

    const { getKanbanState, saveKanbanState, updateStoryPRLink } = await import("~/utils/kanban.server");

    const state = await getKanbanState();
    const updatedState = updateStoryPRLink(state, storyId, prLink === "" ? null : prLink as string);
    await saveKanbanState(updatedState);

    return { success: true };
  }

  if (intent === "archive") {
    const storyId = formData.get("storyId");

    if (typeof storyId !== "string") {
      return { error: "Invalid archive request" };
    }

    const { getKanbanState, saveKanbanState, updateStoryStatus } = await import("~/utils/kanban.server");

    const state = await getKanbanState();
    const updatedState = updateStoryStatus(state, storyId, "archive");
    await saveKanbanState(updatedState);

    return { success: true };
  }

  return { error: "Unknown intent" };
}

export default function Kanban() {
  const { state, projects } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const syncFetcher = useFetcher();
  const revalidator = useRevalidator();

  // Track sync completion to trigger revalidation
  useEffect(() => {
    if (syncFetcher.state === "idle" && syncFetcher.data) {
      revalidator.revalidate();
    }
  }, [syncFetcher.state, syncFetcher.data, revalidator]);

  const handleStoryMove = (storyId: string, newStatus: KanbanStatus) => {
    fetcher.submit(
      { intent: "move", storyId, status: newStatus },
      { method: "post" }
    );
  };

  const handleTitleChange = (storyId: string, newTitle: string) => {
    fetcher.submit(
      { intent: "updateTitle", storyId, title: newTitle },
      { method: "post" }
    );
  };

  const handlePRLinkChange = (storyId: string, prLink: string | null) => {
    fetcher.submit(
      { intent: "updatePRLink", storyId, prLink: prLink ?? "" },
      { method: "post" }
    );
  };

  const handleArchive = (storyId: string) => {
    fetcher.submit(
      { intent: "archive", storyId },
      { method: "post" }
    );
  };

  const handleSync = useCallback(async () => {
    syncFetcher.submit(
      { intent: "sync" },
      { method: "post" }
    );
  }, [syncFetcher]);

  const isSyncing = syncFetcher.state !== "idle";

  return (
    <main className="p-4 pt-16 md:pt-14 h-screen flex flex-col">
      <h1 className="text-xl font-semibold mb-4">Kanban Board</h1>
      <div className="flex-1 min-h-0">
        <KanbanBoard
          state={state}
          projects={projects}
          onStoryMove={handleStoryMove}
          onTitleChange={handleTitleChange}
          onPRLinkChange={handlePRLinkChange}
          onArchive={handleArchive}
          onSync={handleSync}
          isSyncing={isSyncing}
        />
      </div>
    </main>
  );
}
