import { useState, useRef, useEffect } from "react";

type Props = {
  projects: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function ProjectMultiSelect({ projects, selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = projects.filter(
    (p) =>
      !selected.includes(p) &&
      p.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addProject = (p: string) => {
    onChange([...selected, p]);
    setQuery("");
    inputRef.current?.focus();
  };

  const removeProject = (p: string) => {
    onChange(selected.filter((s) => s !== p));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[highlightIdx]) {
      e.preventDefault();
      addProject(filtered[highlightIdx]);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      removeProject(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 p-1.5 border border-gray-600 rounded-lg bg-gray-800 min-h-[38px]">
        {selected.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full text-xs"
          >
            {p.length > 30 ? "..." + p.slice(-27) : p}
            <button
              onClick={() => removeProject(p)}
              className="hover:text-blue-100"
              type="button"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "All projects" : "Add..."}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
          {filtered.map((p, i) => (
            <li
              key={p}
              className={`px-3 py-1.5 text-sm cursor-pointer ${
                i === highlightIdx
                  ? "bg-blue-800 text-blue-200"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addProject(p);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
