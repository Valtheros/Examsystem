import { ZodError } from "zod";
import { getErrorMessage } from "@/lib/errors";

export type ActionState = {
  ok: boolean;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = { ok: false, message: "" };

export function actionError(error: unknown): ActionState {
  return {
    ok: false,
    message: getErrorMessage(error),
    ...(error instanceof ZodError ? { fieldErrors: error.issues.reduce<Record<string, string[]>>((fields, issue) => {
      const key = issue.path.join(".");
      (fields[key] ??= []).push(/[\u0E00-\u0E7F]/.test(issue.message) ? issue.message : "กรุณาตรวจสอบข้อมูลช่องนี้");
      return fields;
    }, {}) } : {}),
  };
}
