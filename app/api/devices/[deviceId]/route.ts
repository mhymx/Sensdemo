import { getHostedConfig, isDashboardAuthorized } from "../../../../lib/config";
import { getHostedDevice } from "../../../../lib/hosted-store";

type RouteContext = {
  params: { deviceId: string } | Promise<{ deviceId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const config = getHostedConfig();
  if (!isDashboardAuthorized(request, config)) {
    return Response.json({ error: "unauthorized dashboard request" }, { status: 401 });
  }

  const params = await context.params;
  const deviceId = decodeURIComponent(params.deviceId);
  try {
    const device = await getHostedDevice(deviceId, config);
    if (!device) {
      return Response.json({ error: "device not found" }, { status: 404 });
    }
    return Response.json(device, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "device is unavailable" }, { status: 503 });
  }
}
