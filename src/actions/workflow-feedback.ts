"use server";

import { transitionRequestAction, cancelRequestAction } from "@/actions/requests";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/actions/types";
import { AppError } from "@/lib/errors";
import { ZodError } from "zod";

async function run(action: (data: FormData) => Promise<void>, data: FormData): Promise<ActionState> {
  try {
    await action(data);
    return { ok: true, message: "บันทึกเรียบร้อยแล้ว" };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "กรุณาตรวจสอบข้อมูล", fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
    console.error("Workflow action failed", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณารีเฟรชเพื่อตรวจสอบสถานะล่าสุดก่อนลองอีกครั้ง" };
  }
}

export async function transitionWithFeedback(_previous: ActionState, data: FormData) {
  return run(transitionRequestAction, data);
}

export async function cancelWithFeedback(_previous: ActionState, data: FormData) {
  return run(cancelRequestAction, data);
}
