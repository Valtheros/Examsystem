import { ZodError } from "zod";

export function getErrorMessage(error: unknown, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง") {
  const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "";
  // Database/ORM failures belong in server logs, not in the form's error message.
  if (error instanceof Error && ("cause" in error || "code" in error) && !(error instanceof AppError)) return fallback;
  return message && /[\u0E00-\u0E7F]/.test(message) ? message : error instanceof ZodError ? "กรุณาตรวจสอบข้อมูลที่กรอกให้ถูกต้อง" : fallback;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "กรุณาเข้าสู่ระบบ") {
    super(message, 401, "UNAUTHENTICATED");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "คุณไม่มีสิทธิ์ดำเนินการนี้") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error(error);
  return Response.json(
    { ok: false, code: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาดในระบบ" },
    { status: 500 },
  );
}
