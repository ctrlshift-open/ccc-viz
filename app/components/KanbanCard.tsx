import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { KanbanCard as KanbanCardType } from "~/types/kanban";

type Props = {
  card: KanbanCardType;
  onTitleChange?: (id: string, newTitle: string) => void;
  onDragStart?: (e: React.DragEvent, card: KanbanCardType) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onCardDrop?: (targetCard: KanbanCardType) => void;
  isDragTarget?: boolean;
};

export function KanbanCard({ card, onTitleChange, onDragStart, onDragEnd, onCardDrop, isDragTarget }: Props) {
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
      {/* Title - editable */}
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
          <button
            onClick={handleTitleClick}
            className="text-left w-full text-sm font-medium text-gray-100 hover:text-blue-400 line-clamp-2"
            title="Click to edit title"
          >
            {card.title}
          </button>
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
