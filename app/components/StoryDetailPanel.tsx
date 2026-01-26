import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { KanbanStory } from "~/types/kanban";

type Props = {
  story: KanbanStory | null;
  onClose: () => void;
  onTitleChange?: (id: string, newTitle: string) => void;
  onPRLinkChange?: (id: string, prLink: string | null) => void;
  onArchive?: (id: string) => void;
};

export function StoryDetailPanel({
  story,
  onClose,
  onTitleChange,
  onPRLinkChange,
  onArchive,
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingPRLink, setIsEditingPRLink] = useState(false);
  const [editPRLink, setEditPRLink] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const prInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset edit states when story changes
  useEffect(() => {
    setIsEditingTitle(false);
    setIsEditingPRLink(false);
    if (story) {
      setEditTitle(story.title);
      setEditPRLink(story.prLink || "");
    }
  }, [story?.id]);

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Focus PR input when editing
  useEffect(() => {
    if (isEditingPRLink && prInputRef.current) {
      prInputRef.current.focus();
      prInputRef.current.select();
    }
  }, [isEditingPRLink]);

  // Escape key closes panel
  useEffect(() => {
    if (!story) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditingTitle) {
          setIsEditingTitle(false);
          setEditTitle(story.title);
        } else if (isEditingPRLink) {
          setIsEditingPRLink(false);
          setEditPRLink(story.prLink || "");
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [story, isEditingTitle, isEditingPRLink, onClose]);

  // Body scroll lock when open
  useEffect(() => {
    if (story) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [story]);

  if (!story) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setEditTitle(story.title);
  };

  const handleTitleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== story.title) {
      onTitleChange?.(story.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setEditTitle(story.title);
      setIsEditingTitle(false);
    }
  };

  const handlePRLinkClick = () => {
    setIsEditingPRLink(true);
    setEditPRLink(story.prLink || "");
  };

  const handlePRLinkSave = () => {
    const trimmed = editPRLink.trim();
    if (trimmed !== (story.prLink || "")) {
      onPRLinkChange?.(story.id, trimmed || null);
    }
    setIsEditingPRLink(false);
  };

  const handlePRLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePRLinkSave();
    } else if (e.key === "Escape") {
      setEditPRLink(story.prLink || "");
      setIsEditingPRLink(false);
    }
  };

  const handleArchive = () => {
    onArchive?.(story.id);
    onClose();
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatProjectPath = (project: string) => {
    // Convert -Users-username-code-project to /Users/username/code/project
    return project.replace(/^-/, "/").replace(/-/g, "/");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full sm:w-[400px] h-full bg-gray-900 border-l border-gray-700 shadow-xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Story Details</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 rounded"
            title="Close (Escape)"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
              Title
            </label>
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <button
                onClick={handleTitleClick}
                className="w-full text-left text-gray-100 hover:text-blue-400 py-1 flex items-center gap-2"
                title="Click to edit"
              >
                <span className="break-words">{story.title}</span>
                <svg
                  className="w-4 h-4 text-gray-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
              Project
            </label>
            <p className="text-gray-300 text-sm break-all">
              {formatProjectPath(story.project)}
            </p>
          </div>

          {/* Branch */}
          {story.branch && (
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
                Branch
              </label>
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <span className="text-green-400">🌿</span>
                <span className="break-all">{story.branch}</span>
              </div>
            </div>
          )}

          {/* PR Link */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
              Pull Request
            </label>
            {isEditingPRLink ? (
              <input
                ref={prInputRef}
                type="text"
                value={editPRLink}
                onChange={(e) => setEditPRLink(e.target.value)}
                onBlur={handlePRLinkSave}
                onKeyDown={handlePRLinkKeyDown}
                placeholder="https://github.com/.../pull/123"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              />
            ) : story.prLink ? (
              <div className="flex items-center gap-2">
                <a
                  href={story.prLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm break-all"
                >
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>{story.prLink}</span>
                </a>
                <button
                  onClick={handlePRLinkClick}
                  className="p-1 text-gray-500 hover:text-gray-300"
                  title="Edit PR link"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={handlePRLinkClick}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                + Add PR link
              </button>
            )}
          </div>

          {/* Sessions */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">
              Sessions ({story.sessions.length})
            </label>
            <div className="space-y-2">
              {story.sessions.map((session) => (
                <Link
                  key={session.id}
                  to={session.link}
                  className="block p-2 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="text-sm text-blue-400 hover:text-blue-300 break-words">
                    {session.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(session.timestamp)}
                  </div>
                </Link>
              ))}
              {story.sessions.length === 0 && (
                <p className="text-sm text-gray-500 italic">No sessions</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Created
                </label>
                <p className="text-gray-400">{formatDate(story.createdAt)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Updated
                </label>
                <p className="text-gray-400">{formatDate(story.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700">
          <button
            onClick={handleArchive}
            className="w-full px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
            </svg>
            Archive Story
          </button>
        </div>
      </div>
    </div>
  );
}
