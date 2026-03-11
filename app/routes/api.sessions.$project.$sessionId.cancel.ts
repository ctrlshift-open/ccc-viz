export async function action({ params }: { params: { sessionId: string; project: string } }) {
  const { sessionId } = params;

  // Dynamic import to keep Node.js modules server-only
  const { cancelProcess } = await import("~/claude-cli.server");

  const cancelled = cancelProcess(sessionId);

  return Response.json({
    success: cancelled,
    message: cancelled
      ? "Process cancellation requested"
      : "No active process found",
  });
}