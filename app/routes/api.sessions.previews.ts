import type { Route } from "./+types/api.sessions.previews";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project");
  const ids = url.searchParams.get("ids");
  
  if (!project || !ids) {
    return Response.json({ error: "Missing project or ids parameter" }, { status: 400 });
  }
  
  const sessionIds = ids.split(",").filter(Boolean);
  if (sessionIds.length === 0) {
    return Response.json({ error: "No session IDs provided" }, { status: 400 });
  }
  
  // Import server module only in loader
  const { getSessionPreviews } = await import("~/sessions.server");
  const previews = await getSessionPreviews(project, sessionIds);
  
  return Response.json(previews);
}