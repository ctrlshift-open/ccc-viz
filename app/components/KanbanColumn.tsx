import { StoryCard } from "./StoryCard";
import type { KanbanStory, KanbanStatus } from "~/types/kanban";
import { KANBAN_LABELS } from "~/types/kanban";

type Props = {
  status: KanbanStatus;
  stories: KanbanStory[];
  onTitleChange?: (id: string, newTitle: string) => void;
  onPRLinkChange?: (id: string, prLink: string | null) => void;
  onArchive?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, story: KanbanStory) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, status: KanbanStatus) => void;
  isDragOver?: boolean;
};

export function KanbanColumn({
  status,
  stories,
  onTitleChange,
  onPRLinkChange,
  onArchive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver,
}: Props) {
  const sortedStories = [...stories].sort((a, b) => a.order - b.order);

  return (
    <div
      className={`flex flex-col min-w-[300px] w-[300px] bg-gray-900 rounded-lg border ${
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
          {stories.length}
        </span>
      </div>

      {/* Story list */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {sortedStories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            onTitleChange={onTitleChange}
            onPRLinkChange={onPRLinkChange}
            onArchive={onArchive}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {stories.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-4">
            No stories
          </div>
        )}
      </div>
    </div>
  );
}
