import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { KanbanCard as KanbanCardType } from "~/types/kanban";

type Props = {
  card: KanbanCardType;
  onTitleChange?: (id: string, newTitle: string) => void;
  onTitleRegenerate?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, card: KanbanCardType) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onCardDrop?: (targetCard: KanbanCardType) => void;
  isDragTarget?: boolean;
  isRegenerating?: boolean;
};

export function KanbanCard({ card, onTitleChange, onTitleRegenerate, onDragStart, onDragEnd, onCardDrop, isDragTarget, isRegenerating }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(card.title);
  };

  const handleTitleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== card.title) {
      onTitleChange?.(card.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setEditTitle(card.title);
      setIsEditing(false);
    }
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTitleRegenerate?.(card.id);
  };

  const sessionCount = card.sessionIds.length;
  const isMerged = sessionCount > 1;

  // Format timestamp for display
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCardDrop?.(card);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, card)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`bg-gray-800 border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-colors ${
        isDragTarget ? "border-purple-500 bg-purple-900/30" : "border-gray-700 hover:border-gray-500"
      }`}
    >
      {/* Title - editable with regenerate button */}
      <div className="mb-2">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          />
        ) : (
          <div className="flex items-start gap-1">
            <button
              onClick={handleTitleClick}
              className="text-left flex-1 text-sm font-medium text-gray-100 hover:text-blue-400 line-clamp-2"
              title="Click to edit title"
            >
              {card.title}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Regenerate title with AI"
            >
              {isRegenerating ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2Z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-400 items-center mb-2">
        {/* Project badge */}
        <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
          {card.project}
        </span>

        {/* Git branch */}
        {card.gitBranch && (
          <span className="flex items-center gap-1" title={card.gitBranch}>
            <span>🌿</span>
            <span className="max-w-[100px] truncate">{card.gitBranch}</span>
          </span>
        )}

        {/* Timestamp */}
        <span>{formatDate(card.createdAt)}</span>

        {/* Merged badge */}
        {isMerged && (
          <span className="px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">
            [{sessionCount} sessions]
          </span>
        )}
      </div>

      {/* Link to session detail */}
      <Link
        to={`/${encodeURIComponent(card.project)}/sessions/${encodeURIComponent(card.sessionIds[0])}`}
        className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        View session →
      </Link>
    </div>
  );
}
