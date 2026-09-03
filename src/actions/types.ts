export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = { ok: false, message: "" };

export function actionError(error: unknown): ActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในระบบ",
  };
}
