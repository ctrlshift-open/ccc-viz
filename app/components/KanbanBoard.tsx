import { useState, useMemo } from "react";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanCard, KanbanState, KanbanStatus } from "~/types/kanban";
import { KANBAN_COLUMNS } from "~/types/kanban";

type Props = {
  state: KanbanState;
  projects: string[];
  onCardMove?: (cardId: string, newStatus: KanbanStatus) => void;
  onTitleChange?: (cardId: string, newTitle: string) => void;
};

export function KanbanBoard({ state, projects, onCardMove, onTitleChange }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

  // Filter cards by search and project
  const filteredCards = useMemo(() => {
    return state.cards.filter((card) => {
      // Project filter
      if (projectFilter !== "all" && card.project !== projectFilter) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return card.title.toLowerCase().includes(query);
      }
      return true;
    });
  }, [state.cards, searchQuery, projectFilter]);

  // Group cards by status
  const cardsByStatus = useMemo(() => {
    const grouped: Record<KanbanStatus, KanbanCard[]> = {
      archive: [],
      "back-log": [],
      "in-progress": [],
      discard: [],
      complete: [],
    };
    filteredCards.forEach((card) => {
      grouped[card.status].push(card);
    });
    return grouped;
  }, [filteredCards]);

  const handleDragStart = (e: React.DragEvent, card: KanbanCard) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (status: KanbanStatus) => {
    setDragOverColumn(status);
  };

  const handleDrop = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId && draggedCard && draggedCard.status !== status) {
      onCardMove?.(cardId, status);
    }
    setDraggedCard(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search cards..."
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

        {/* Card count */}
        <span className="text-sm text-gray-500">
          {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
          {(searchQuery || projectFilter !== "all") && ` (filtered from ${state.cards.length})`}
        </span>
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            cards={cardsByStatus[status]}
            onTitleChange={onTitleChange}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={() => handleDragOver(status)}
            onDrop={handleDrop}
            isDragOver={dragOverColumn === status && draggedCard?.status !== status}
          />
        ))}
      </div>
    </div>
  );
}
