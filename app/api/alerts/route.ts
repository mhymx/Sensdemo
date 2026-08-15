import { getHostedConfig, isDeviceAuthorized } from "../../../lib/config";
import {
  recordHostedAlert,
  validateHostedAlert,
} from "../../../lib/hosted-store";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(request: Request) {
  const config = getHostedConfig();
  if (!config.apiKey) {
    return Response.json(
      { error: "device authentication is not configured" },
      { status: 503 }
    );
  }
  if (!isDeviceAuthorized(request, config)) {
    return Response.json({ error: "unauthorized device" }, { status: 401 });
  }

  let payload: unknown;
  try {
    const text = await request.text();
    if (text.length > 32768) {
      return Response.json({ error: "request body is too large" }, { status: 413 });
    }
    payload = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "request body must be valid JSON" },
      { status: 400 }
    );
  }

  const validation = validateHostedAlert(payload);
  if (!validation.ok) {
    return Response.json(
      { error: "invalid alert payload", details: validation.errors },
      { status: 400 }
    );
  }

  try {
    const recorded = await recordHostedAlert(validation.value, config);
    return Response.json(
      {
        accepted: true,
        event_id: recorded.event.id,
        notification_suppressed: recorded.notificationSuppressed,
        integrations: recorded.integrations,
      },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "alert could not be stored or relayed" },
      { status: 503 }
    );
  }
}
