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
