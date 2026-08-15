import { getHostedConfig } from "../../../lib/config";
import { getHostedHealth } from "../../../lib/hosted-store";

export async function GET() {
  try {
    const body = await getHostedHealth(getHostedConfig());
    return Response.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "health check failed",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
