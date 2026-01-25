import { KanbanCard } from "./KanbanCard";
import type { KanbanCard as KanbanCardType, KanbanStatus } from "~/types/kanban";
import { KANBAN_LABELS } from "~/types/kanban";

type Props = {
  status: KanbanStatus;
  cards: KanbanCardType[];
  onTitleChange?: (id: string, newTitle: string) => void;
  onTitleRegenerate?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, card: KanbanCardType) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, status: KanbanStatus) => void;
  isDragOver?: boolean;
  onCardDrop?: (targetCard: KanbanCardType) => void;
  dragTargetId?: string | null;
  regeneratingCardId?: string | null;
};

export function KanbanColumn({
  status,
  cards,
  onTitleChange,
  onTitleRegenerate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver,
  onCardDrop,
  dragTargetId,
  regeneratingCardId,
}: Props) {
  const sortedCards = [...cards].sort((a, b) => a.order - b.order);

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] bg-gray-900 rounded-lg border ${
        isDragOver ? "border-blue-500 bg-gray-800" : "border-gray-700"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, status);
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">
          {KANBAN_LABELS[status]}
        </h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
          {cards.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {sortedCards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onTitleChange={onTitleChange}
            onTitleRegenerate={onTitleRegenerate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onCardDrop={onCardDrop}
            isDragTarget={dragTargetId === card.id}
            isRegenerating={regeneratingCardId === card.id}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-4">
            No cards
          </div>
        )}
      </div>
    </div>
  );
}
