import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { KanbanStory } from "~/types/kanban";

type Props = {
  story: KanbanStory;
  isSelected?: boolean;
  onSelect?: (storyId: string) => void;
  onArchive?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, story: KanbanStory) => void;
  onDragEnd?: (e: React.DragEvent) => void;
};

export function StoryCard({ story, isSelected, onSelect, onArchive, onDragStart, onDragEnd }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    onArchive?.(story.id);
  };

  // Track mouse position on mousedown to differentiate click vs drag
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger selection if this was a drag or clicking interactive elements
    if (isDragging) return;

    // Check if mouse moved significantly (drag detection)
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) return; // Was a drag, not a click
    }

    onSelect?.(story.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart?.(e, story);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    onDragEnd?.(e);
  };

  // Format timestamp for display
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  // Extract PR number from URL
  const getPRNumber = (url: string) => {
    const match = url.match(/\/pull\/(\d+)/);
    return match ? `#${match[1]}` : "PR";
  };

  const sessionCount = story.sessions.length;
  const visibleSessions = sessionsExpanded ? story.sessions : story.sessions.slice(0, 3);
  const hasMoreSessions = story.sessions.length > 3;

  return (
    <div
      draggable
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`bg-gray-800 border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-500 transition-colors ${
        isSelected ? "border-blue-500 ring-2 ring-blue-500" : "border-gray-700"
      }`}
    >
      {/* Header row: project + PR link + menu */}
      <div className="flex items-center justify-between mb-2">
        <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">
          {story.project.replace(/-Users-[^-]+-[^-]+-/, "").replace(/-/g, "/")}
        </span>
        <div className="flex items-center gap-1">
          {/* PR link */}
          {story.prLink ? (
            <a
              href={story.prLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              title={story.prLink}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
              </svg>
              {getPRNumber(story.prLink)}
            </a>
          ) : (
            <span className="text-xs text-gray-500">No PR</span>
          )}
          {/* Action menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 text-gray-400 hover:text-gray-200"
              title="More actions"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={handleArchive}
                  className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                  Archive
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Title - branch name, read-only on card (edit in panel) */}
      <div className="mb-2">
        <div className="text-left w-full text-sm font-medium text-gray-100 flex items-center gap-1">
          {story.branch && <span className="text-green-400">🌿</span>}
          <span className="line-clamp-1">{story.title}</span>
        </div>
      </div>

      {/* Sessions section */}
      <div className="mb-2">
        <button
          onClick={(e) => { e.stopPropagation(); setSessionsExpanded(!sessionsExpanded); }}
          className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1 mb-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${sessionsExpanded ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
          Sessions ({sessionCount})
        </button>
        <div className="space-y-1 pl-2">
          {visibleSessions.map((session) => (
            <Link
              key={session.id}
              to={session.link}
              onClick={(e) => e.stopPropagation()}
              className="block text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
              title={`${session.name} - ${formatDate(session.timestamp)}`}
            >
              • {session.name} <span className="text-gray-500">({formatDate(session.timestamp)})</span>
            </Link>
          ))}
          {hasMoreSessions && !sessionsExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setSessionsExpanded(true); }}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              +{story.sessions.length - 3} more...
            </button>
          )}
        </div>
      </div>

      {/* Footer: creation date */}
      <div className="text-xs text-gray-500">
        Created {formatDate(story.createdAt)}
      </div>
    </div>
  );
}
