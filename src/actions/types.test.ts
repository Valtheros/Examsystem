import { expect, it } from "vitest";
import { z } from "zod";
import { actionError } from "./types";

it("turns Zod errors into Thai feedback, never raw JSON or SQL", () => {
  const parsed = z.array(z.object({ count: z.number().max(10000, "จำนวนชุดข้อสอบต้องไม่เกิน 10,000 ชุด") })).safeParse([{ count: 10001 }]);
  if (parsed.success) throw new Error("Expected invalid input");
  const result = actionError(parsed.error);
  expect(result.message).toBe("จำนวนชุดข้อสอบต้องไม่เกิน 10,000 ชุด");
  expect(result.fieldErrors?.["0.count"]).toEqual([result.message]);
  expect(result.message).not.toContain("too_big");
  expect(actionError(new Error("Failed query: secret SQL คณะ", { cause: new Error("database failure") })).message).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
});
