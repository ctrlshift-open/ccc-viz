import { useState, useMemo } from "react";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanStory, KanbanState, KanbanStatus } from "~/types/kanban";
import { KANBAN_DISPLAY_COLUMNS } from "~/types/kanban";

type Props = {
  state: KanbanState;
  projects: string[];
  onStoryMove?: (storyId: string, newStatus: KanbanStatus) => void;
  onTitleChange?: (storyId: string, newTitle: string) => void;
  onPRLinkChange?: (storyId: string, prLink: string | null) => void;
  onArchive?: (storyId: string) => void;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
};

export function KanbanBoard({ state, projects, onStoryMove, onTitleChange, onPRLinkChange, onArchive, onSync, isSyncing }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [draggedStory, setDraggedStory] = useState<KanbanStory | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

  // Filter stories by search and project (exclude archived)
  const filteredStories = useMemo(() => {
    return state.stories.filter((story) => {
      // Exclude archived stories
      if (story.status === "archive") {
        return false;
      }
      // Project filter
      if (projectFilter !== "all" && story.project !== projectFilter) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        // Search in title, branch, and session names
        return (
          story.title.toLowerCase().includes(query) ||
          story.branch?.toLowerCase().includes(query) ||
          story.sessions.some(s => s.name.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [state.stories, searchQuery, projectFilter]);

  // Count non-archived stories for display
  const totalNonArchivedStories = useMemo(() => {
    return state.stories.filter((story) => story.status !== "archive").length;
  }, [state.stories]);

  // Group stories by status
  const storiesByStatus = useMemo(() => {
    const grouped: Record<KanbanStatus, KanbanStory[]> = {
      archive: [],
      "back-log": [],
      "in-progress": [],
      discard: [],
      complete: [],
    };
    filteredStories.forEach((story) => {
      grouped[story.status].push(story);
    });
    return grouped;
  }, [filteredStories]);

  const handleDragStart = (e: React.DragEvent, story: KanbanStory) => {
    setDraggedStory(story);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", story.id);
  };

  const handleDragEnd = () => {
    setDraggedStory(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (status: KanbanStatus) => {
    setDragOverColumn(status);
  };

  const handleDrop = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const storyId = e.dataTransfer.getData("text/plain");
    if (storyId && draggedStory && draggedStory.status !== status) {
      onStoryMove?.(storyId, status);
    }
    setDraggedStory(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        {/* Sync button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isSyncing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Sessions
            </>
          )}
        </button>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Story count */}
        <span className="text-sm text-gray-500">
          {filteredStories.length} stor{filteredStories.length !== 1 ? "ies" : "y"}
          {(searchQuery || projectFilter !== "all") && ` (filtered from ${totalNonArchivedStories})`}
        </span>

        {/* Empty state hint */}
        {state.stories.length === 0 && (
          <span className="text-sm text-amber-500">
            Click "Sync Sessions" to import sessions
          </span>
        )}
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_DISPLAY_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            stories={storiesByStatus[status]}
            onTitleChange={onTitleChange}
            onPRLinkChange={onPRLinkChange}
            onArchive={onArchive}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={() => handleDragOver(status)}
            onDrop={handleDrop}
            isDragOver={dragOverColumn === status && draggedStory?.status !== status}
          />
        ))}
      </div>
    </div>
  );
}
