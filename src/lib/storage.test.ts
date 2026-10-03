import { expect, it, vi } from "vitest";
import { createExamUploadUrl } from "@/lib/storage";

vi.mock("server-only", () => ({}));

it("signs the SHA headers sent by the browser without hoisting duplicate metadata", async () => {
  const sha256 = "a".repeat(64);
  const signed = await createExamUploadUrl({ storageKey: "exam-files/test.pdf", sizeBytes: 100, sha256 });
  const query = new URL(signed.url).searchParams;
  expect(query.get("X-Amz-SignedHeaders")).toContain("x-amz-meta-sha256");
  expect(query.get("X-Amz-SignedHeaders")).toContain("x-amz-checksum-sha256");
  expect(query.has("x-amz-meta-sha256")).toBe(false);
  expect(signed.headers["x-amz-checksum-sha256"]).toBe(Buffer.from(sha256, "hex").toString("base64"));
});
