import { getInstructorNotifications } from "@/lib/notifications";
import { ROLES } from "@/lib/constants";
import { errorResponse } from "@/lib/errors";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireRole([ROLES.INSTRUCTOR]);
    return Response.json({ notifications: await getInstructorNotifications(session.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
