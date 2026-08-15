import { getHostedConfig, isDashboardAuthorized } from "../../../lib/config";
import { getHostedDevices } from "../../../lib/hosted-store";

export async function GET(request: Request) {
  const config = getHostedConfig();
  if (!isDashboardAuthorized(request, config)) {
    return Response.json({ error: "unauthorized dashboard request" }, { status: 401 });
  }

  try {
    return Response.json(
      {
        generated_at: new Date().toISOString(),
        offline_after_ms: config.offlineAfterMs,
        devices: await getHostedDevices(config),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "state is unavailable" }, { status: 503 });
  }
}
