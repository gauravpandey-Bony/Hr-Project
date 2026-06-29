export async function parseApiJsonResponse(
  res: Response
): Promise<Record<string, unknown>> {
  const raw = await res.text();
  if (!raw.trim()) return {};

  try {
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return { data };
  } catch {
    const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 240);
    const hint =
      res.status === 502 || res.status === 504
        ? "Server timed out or restarted during import — wait a minute and try again."
        : "Server returned a non-JSON response.";
    throw new Error(
      snippet
        ? `${hint} (HTTP ${res.status}: ${snippet})`
        : `${hint} (HTTP ${res.status})`
    );
  }
}
