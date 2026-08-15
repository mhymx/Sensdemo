import { getHostedConfig, isDashboardAuthorized } from "../../../lib/config";
import { getHostedEvents } from "../../../lib/hosted-store";

export async function GET(request: Request) {
  const config = getHostedConfig();
  if (!isDashboardAuthorized(request, config)) {
    return Response.json({ error: "unauthorized dashboard request" }, { status: 401 });
  }

  const url = new URL(request.url);
  try {
    return Response.json(
      {
        events: await getHostedEvents(config, {
          device: url.searchParams.get("device") || undefined,
          limit: url.searchParams.get("limit") || 100,
        }),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "event history is unavailable" }, { status: 503 });
  }
}
