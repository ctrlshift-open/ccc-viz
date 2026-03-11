import { Link, useLocation, useParams } from "react-router";

export function DesktopNav() {
  const location = useLocation();
  const params = useParams();

  const isProjectRoute = location.pathname.includes("/sessions");
  const projectName = params.project
    ? decodeURIComponent(params.project)
    : null;

  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-40 items-center px-4 gap-6">
      {/* Logo */}
      <Link
        to="/"
        className="font-semibold text-gray-900 dark:text-gray-100 shrink-0"
      >
        CCC Viz
      </Link>

      {/* Main links */}
      <div className="flex items-center gap-1">
        <Link
          to="/"
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            location.pathname === "/"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
        >
          Projects
        </Link>
        <Link
          to="/kanban"
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            location.pathname === "/kanban"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
        >
          Kanban
        </Link>
        <Link
          to="/search"
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            location.pathname === "/search"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
        >
          Search
        </Link>
      </div>

      {/* Breadcrumb for project/session routes */}
      {isProjectRoute && projectName && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>/</span>
          <Link
            to={`/${encodeURIComponent(projectName)}/sessions`}
            className={`px-2 py-1 rounded transition-colors ${
              location.pathname.endsWith("/sessions")
                ? "text-blue-700 dark:text-blue-300"
                : "hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            {projectName.length > 40
              ? "..." + projectName.slice(-37)
              : projectName}
          </Link>
          {params.sessionId && (
            <>
              <span>/</span>
              <span className="text-gray-400 dark:text-gray-500 truncate max-w-48">
                {params.sessionId.slice(0, 8)}...
              </span>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
