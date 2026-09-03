import { randomUUID } from "node:crypto";

import { canUploadExamFile } from "@/lib/permissions";
import { errorResponse, AuthorizationError } from "@/lib/errors";
import { getAuthorizedRequest } from "@/lib/request-access";
import { requireSession } from "@/lib/session";
import { createExamUploadUrl } from "@/lib/storage";
import { uploadUrlSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = uploadUrlSchema.parse(await request.json());
    const examRequest = await getAuthorizedRequest(input.requestId, session);
    if (
      !canUploadExamFile(
        {
          role: session.user.role,
          userId: session.user.id,
          instructorId: examRequest.instructorId,
          status: examRequest.status,
          cancelledAt: examRequest.cancelledAt,
        },
        input.kind,
      )
    ) {
      throw new AuthorizationError("สถานะหรือบทบาทปัจจุบันไม่อนุญาตให้อัปโหลดไฟล์");
    }
    if (!input.fileName.toLowerCase().endsWith(".pdf")) {
      throw new AuthorizationError("อนุญาตเฉพาะไฟล์นามสกุล .pdf");
    }

    const storageKey = `exam-files/${input.requestId}/${randomUUID()}.pdf`;
    const signed = await createExamUploadUrl({
      storageKey,
      sizeBytes: input.fileSize,
      sha256: input.sha256,
    });
    return Response.json({ ok: true, storageKey, ...signed });
  } catch (error) {
    return errorResponse(error);
  }
}
