import { useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface FileViewerProps {
  filepath: string;
  content: string;
  onClose: () => void;
}

function SafePre({ children, className = "" }: { children: string; className?: string }) {
  return (
    <pre className={`text-xs sm:text-sm whitespace-pre-wrap break-words break-all max-w-full ${className}`}>
      <code>{children}</code>
    </pre>
  );
}

export function FileViewer({ filepath, content, onClose }: FileViewerProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const filename = filepath.split("/").pop() || filepath;

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900 bg-opacity-95 overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-labelledby="file-viewer-title"
      aria-modal="true"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close file viewer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 id="file-viewer-title" className="text-sm md:text-base font-semibold text-white truncate flex-1">
          {filename}
        </h2>
        <span className="text-xs text-gray-500 px-2 py-1 rounded bg-gray-800">
          {filepath.split("/").slice(0, -1).join("/") || "."}
        </span>
      </div>

      {/* Content */}
      <div
        className="p-4 md:p-8 max-w-screen-md mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 md:p-6">
          <div className="prose prose-invert prose-sm md:prose-base max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl md:text-2xl font-bold mt-6 mb-3 break-words first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg md:text-xl font-bold mt-5 mb-2 break-words">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base md:text-lg font-semibold mt-4 mb-2 break-words">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold mt-3 mb-1 break-words">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="my-3 text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-6 my-3 space-y-1.5 text-sm md:text-base">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-6 my-3 space-y-1.5 text-sm md:text-base">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="break-words leading-relaxed">{children}</li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300 break-all"
                  >
                    {children}
                  </a>
                ),
                code: ({ children, className }) => {
                  const content = String(children ?? "");
                  const isInline = !className?.includes("language-");
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-gray-800 text-blue-300 text-sm">
                        {content}
                      </code>
                    );
                  }
                  return (
                    <div className="overflow-x-auto my-3">
                      <SafePre className="bg-gray-900 p-4 rounded">{content}</SafePre>
                    </div>
                  );
                },
                hr: () => <hr className="my-4 border-t border-gray-700" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-600 pl-4 my-3 text-gray-300 italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 max-w-full">
                    <table className="min-w-full text-left text-sm border-collapse">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-800">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-700 px-3 py-2 font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-800 px-3 py-2 align-top">
                    {children}
                  </td>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Footer with file path */}
      <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-4 py-2 text-xs text-gray-500 text-center">
        {filepath}
      </div>
    </div>
  );
}
