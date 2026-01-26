import { useState, useMemo } from "react";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanCard, KanbanState, KanbanStatus } from "~/types/kanban";
import { KANBAN_DISPLAY_COLUMNS } from "~/types/kanban";

type MergeConfirmation = {
  sourceCard: KanbanCard;
  targetCard: KanbanCard;
};

type Props = {
  state: KanbanState;
  projects: string[];
  onCardMove?: (cardId: string, newStatus: KanbanStatus) => void;
  onTitleChange?: (cardId: string, newTitle: string) => void;
  onTitleRegenerate?: (cardId: string) => Promise<void>;
  onMerge?: (sourceId: string, targetId: string) => void;
  onArchive?: (cardId: string) => void;
};

export function KanbanBoard({ state, projects, onCardMove, onTitleChange, onTitleRegenerate, onMerge, onArchive }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);
  const [mergeConfirmation, setMergeConfirmation] = useState<MergeConfirmation | null>(null);
  const [regeneratingCardId, setRegeneratingCardId] = useState<string | null>(null);

  const handleTitleRegenerate = async (cardId: string) => {
    if (!onTitleRegenerate) return;
    setRegeneratingCardId(cardId);
    try {
      await onTitleRegenerate(cardId);
    } finally {
      setRegeneratingCardId(null);
    }
  };

  // Filter cards by search and project (exclude archived)
  const filteredCards = useMemo(() => {
    return state.cards.filter((card) => {
      // Exclude archived cards
      if (card.status === "archive") {
        return false;
      }
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

  // Count non-archived cards for display
  const totalNonArchivedCards = useMemo(() => {
    return state.cards.filter((card) => card.status !== "archive").length;
  }, [state.cards]);

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

  const handleCardDrop = (targetCard: KanbanCard) => {
    if (draggedCard && draggedCard.id !== targetCard.id) {
      // Show merge confirmation
      setMergeConfirmation({
        sourceCard: draggedCard,
        targetCard,
      });
    }
    setDraggedCard(null);
    setDragOverColumn(null);
  };

  const handleMergeConfirm = () => {
    if (mergeConfirmation) {
      onMerge?.(mergeConfirmation.sourceCard.id, mergeConfirmation.targetCard.id);
      setMergeConfirmation(null);
    }
  };

  const handleMergeCancel = () => {
    setMergeConfirmation(null);
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
          {(searchQuery || projectFilter !== "all") && ` (filtered from ${totalNonArchivedCards})`}
        </span>
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_DISPLAY_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            cards={cardsByStatus[status]}
            onTitleChange={onTitleChange}
            onTitleRegenerate={handleTitleRegenerate}
            onArchive={onArchive}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={() => handleDragOver(status)}
            onDrop={handleDrop}
            isDragOver={dragOverColumn === status && draggedCard?.status !== status}
            onCardDrop={handleCardDrop}
            dragTargetId={draggedCard ? undefined : undefined}
            regeneratingCardId={regeneratingCardId}
          />
        ))}
      </div>

      {/* Merge Confirmation Modal */}
      {mergeConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Merge Cards?</h2>
            <p className="text-gray-300 mb-4">
              Merge "<span className="font-medium">{mergeConfirmation.sourceCard.title}</span>" into "
              <span className="font-medium">{mergeConfirmation.targetCard.title}</span>"?
            </p>
            <p className="text-sm text-gray-400 mb-6">
              The target card will contain sessions from both cards. The source card will be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleMergeCancel}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirm}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
