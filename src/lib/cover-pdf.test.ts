import { describe, expect, it, vi } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFPage } from "pdf-lib";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
import { createCoverPdf, type CoverData } from "./cover-pdf";

const fixture: CoverData = {
  courseCode: "345-211", courseName: "PRINCIPLES OF PROGRAMMING", facultyName: "คณะวิศวกรรมศาสตร์", groupNo: "01",
  examDate: "2026-10-16", startsAt: "09:00", endsAt: "12:00", roomName: "ห้องเรียน",
  studentCount: 50, reserveCount: 2, printCount: 52,
  senderName: "อาจารย์ทดสอบ", envelopeNo: "1/1", submissionForm: null,
};

describe("PSU envelope cover", () => {
  it("uses the subject faculty and room name, omits internal metadata, and leaves faculty/group blanks", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await createCoverPdf(fixture);
      const text = drawText.mock.calls.map(([value]) => value);
      expect(text).toContain("คณะวิศวกรรมศาสตร์");
      expect(text).toContain("ห้องเรียน");
      expect(text).toContain("นศ.คณะ");
      expect(text).not.toContain("คณะวิทยาศาสตร์");
      expect(text).not.toContain("พิมพ์หลัก");
      expect(text.some(value => value.includes("รุ่นพิมพ์") || value.includes("REQ-"))).toBe(false);
      expect(drawText.mock.calls.filter(([value]) => value === "ตอน").map(([, options]) => options?.y)).toEqual([635, 510]);
      drawText.mockClear();
      await createCoverPdf({ ...fixture, facultyName: null });
      expect(drawText.mock.calls.map(([value]) => value)).toContain("คณะ........................................");
    } finally {
      drawText.mockRestore();
    }
  }, 15000);

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
