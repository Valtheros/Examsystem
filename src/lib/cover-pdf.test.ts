import { describe, expect, it, vi } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
import { createCoverPdf, type CoverData } from "./cover-pdf";

const fixture: CoverData = {
  requestNo: "COVER-TEST", courseCode: "345-211", courseName: "PRINCIPLES OF PROGRAMMING", groupNo: "01",
  examDate: "2026-10-16", startsAt: "09:00", endsAt: "12:00", roomCode: "LA4", roomName: "ห้องเรียน",
  studentCount: 50, baseCopyCount: 50, reserveCount: 2, printCount: 52,
  senderName: "อาจารย์ทดสอบ", envelopeNo: "1/1", printRevision: 1, submissionForm: null,
};

describe("PSU envelope cover", () => {
  it("renders one A4 form with only the PSU logo, without a QR image", async () => {
    const result = await createCoverPdf(fixture);
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89);
    const images = pdf.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
    expect(images.keys()).toHaveLength(1);
    expect(result.sha256).toBe(createHash("sha256").update(result.bytes).digest("hex"));
  }, 15000);

  it("continues long advice instead of clipping the form or discarding text", async () => {
    const result = await createCoverPdf({ ...fixture, reserveCount: 0, printCount: 50, note: "คำแนะนำผู้คุมสอบที่ยาวมากต้องไม่ทับช่องลายเซ็น ".repeat(30) });
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPages().every(page => Math.abs(page.getHeight() - 841.89) < 0.01)).toBe(true);
  }, 15000);
});
