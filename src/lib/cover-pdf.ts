import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DraftSubmissionForm } from "./submission-form";

export type CoverData = {
  requestNo: string; courseCode: string; courseName: string; groupNo: string;
  examDate: string; startsAt: string; endsAt: string;
  roomCode: string; roomName: string; building?: string | null;
  studentCount: number; baseCopyCount: number; reserveCount: number; printCount: number;
  senderName: string; note?: string | null;
  envelopeNo: string; printRevision: number; submissionForm: DraftSubmissionForm | null;
};

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const { segment } of new Intl.Segmenter("th", { granularity: "grapheme" }).segment(paragraph)) {
      if (line && font.widthOfTextAtSize(line + segment, size) > width) { lines.push(line); line = ""; }
      line += segment;
    }
    lines.push(line);
  }
  return lines;
}

export async function createCoverPdf(data: CoverData) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [fontBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "fonts", "NotoSansThai.ttf")),
    readFile(path.join(process.cwd(), "public", "images.png")),
  ]);
  const font = await document.embedFont(fontBytes, { subset: true });
  const logo = await document.embedPng(logoBytes);
  const page = document.addPage([595.28, 841.89]);
  const black = rgb(0, 0, 0);
  const left = 42, right = 553, width = right - left;
  const text = (value: string, x: number, y: number, size = 11, target: PDFPage = page) => target.drawText(value, { x, y, size, font, color: black });
  const center = (value: string, y: number, size: number) => text(value, (595.28 - font.widthOfTextAtSize(value, size)) / 2, y, size);
  const dotted = (x: number, end: number, y: number) => {
    for (let start = x; start < end; start += 3) page.drawLine({ start: { x: start, y }, end: { x: Math.min(start + 0.7, end), y }, thickness: 0.5, color: black });
  };
  const overflow: { label: string; value: string }[] = [];
  const field = (label: string, value: string, x: number, y: number, fieldWidth: number) => {
    text(label, x, y);
    const start = x + font.widthOfTextAtSize(label, 11) + 5;
    const available = x + fieldWidth - start;
    dotted(start, x + fieldWidth, y - 3);
    if (!value) return;
    let size = 11;
    while (font.widthOfTextAtSize(value, size) > available && size > 9) size -= 0.5;
    if (font.widthOfTextAtSize(value, size) <= available) text(value, start + 2, y, size);
    else {
      overflow.push({ label, value });
      text(wrap(value, font, 9, available)[0], start + 2, y, 9);
    }
  };

  const logoHeight = 78, logoWidth = logo.width / logo.height * logoHeight;
  page.drawImage(logo, { x: (595.28 - logoWidth) / 2, y: 752, width: logoWidth, height: logoHeight });
  center("คณะวิทยาศาสตร์", 730, 16);
  center("มหาวิทยาลัยสงขลานครินทร์", 705, 16);

  const course = `การสอบวิชา ${data.courseName}`;
  let courseSize = 12;
  while (wrap(course, font, courseSize, width).length > 2 && courseSize > 9) courseSize -= 0.5;
  const courseLines = wrap(course, font, courseSize, width);
  if (courseLines.length > 2) overflow.push({ label: "ชื่อวิชา", value: data.courseName });
  courseLines.slice(0, 2).forEach((value, index) => text(value, left, 677 - index * 18, courseSize));
  field("รหัสวิชา", data.courseCode, left, 635, 280);
  field("ตอน", data.groupNo, 360, 635, 193);
  const [year, month, day] = data.examDate.split("-").map(Number);
  const date = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  field("สอบวันที่", date, left, 610, 280);
  field("เวลา", `${data.startsAt.slice(0, 5)} - ${data.endsAt.slice(0, 5)} น.`, 360, 610, 193);
  field("ห้องสอบ", `${data.roomCode} ${data.roomName}`, left, 585, 280);
  field("เลขประจำซอง", data.envelopeNo, 360, 585, 193);
  field("จำนวนนักศึกษา", `${data.studentCount} คน`, left, 560, 280);
  field("สาขาวิชา", data.submissionForm?.department ?? "", 360, 560, 193);
  field("ซองนี้มีข้อสอบ", `${data.printCount} ชุด (รวมสำรอง)`, left, 535, width);
  field("ข้อสอบสำรอง", `${data.reserveCount} ชุด`, left, 510, 280);
  field("พิมพ์หลัก", `${data.baseCopyCount} ชุด`, 360, 510, 193);

  center("อุปกรณ์ที่ใช้หรือคำแนะนำผู้คุมสอบเพิ่มเติม", 480, 13);
  const form = data.submissionForm;
  const checkbox = (label: string, checked: boolean, x: number, y: number) => {
    page.drawRectangle({ x, y: y - 1, width: 9, height: 9, borderWidth: 0.6, borderColor: black });
    if (checked) {
      page.drawLine({ start: { x: x + 1.5, y: y + 2.5 }, end: { x: x + 4, y: y + 0.5 }, thickness: 1, color: black });
      page.drawLine({ start: { x: x + 4, y: y + 0.5 }, end: { x: x + 8, y: y + 6.5 }, thickness: 1, color: black });
    }
    text(label, x + 16, y, 10);
  };
  ["นำตำราเข้าห้องสอบได้", "นำเครื่องคิดเลขเข้าห้องสอบได้", "ห้ามนำไม้บรรทัดมีสูตรเข้าห้องสอบ"].forEach((label, index) => checkbox(label, form?.materials.includes(label) ?? false, left + 5, 455 - index * 23));
  checkbox("ไม่มี", form?.materials.includes("ไม่มี") ?? false, 315, 455);
  const advice = [form?.otherMaterials, form?.instructions, data.note].filter(Boolean).join(" / ");
  text("อื่น ๆ / คำแนะนำ", 315, 433, 10);
  const adviceLines = advice ? wrap(advice, font, 10, 238) : [];
  if (adviceLines.length > 3) {
    text("ดูคำแนะนำทั้งหมดในหน้ารายละเอียดเพิ่มเติม", 315, 411, 9);
    overflow.push({ label: "อุปกรณ์และคำแนะนำเพิ่มเติม", value: advice });
  } else adviceLines.forEach((value, index) => text(value, 315, 413 - index * 15, 10));
  if (!form) text("อุปกรณ์: ไม่ได้ระบุในระบบเดิม", left + 5, 385, 9);

  field("ผู้ออกข้อสอบ", data.senderName, left, 366, width);
  field("ห้องทำงาน", "", left, 341, 280);
  field("โทรศัพท์ / มือถือ", form?.coordinatorPhone ?? "", 340, 341, 213);

  // Filled by hand on the examination day; these values are never guessed from the database.
  page.drawRectangle({ x: left, y: 59, width, height: 261, borderWidth: 0.8, borderColor: black });
  field("จำนวนนักศึกษาที่เข้าสอบ", "", left + 10, 296, 223);
  text("คน", 282, 296, 10);
  field("จำนวนผู้ขาดสอบ", "", 326, 296, 188);
  text("คน", 523, 296, 10);
  text("รหัสนักศึกษา", left + 18, 270, 10);
  text("ชื่อ - สกุล ผู้ขาดสอบ", left + 148, 270, 10);
  for (let index = 0; index < 3; index++) {
    const y = 245 - index * 23;
    text(`${index + 1}.`, left + 10, y, 10);
    dotted(left + 27, left + 135, y - 3);
    dotted(left + 148, right - 14, y - 3);
  }
  for (let index = 0; index < 3; index++) {
    const y = 168 - index * 24;
    text(`${index + 1}.`, left + 153, y, 10);
    dotted(left + 171, right - 81, y - 3);
    text("ผู้คุมสอบ", right - 74, y, 10);
  }
  field("หมายเหตุ", "", left + 10, 91, width - 24);
  dotted(left + 10, right - 14, 73);
  text(`${data.requestNo} · รุ่นพิมพ์ ${data.printRevision}`, left, 35, 8);

  // Keep the reference form on page one; unusually long values continue without clipping.
  if (overflow.length) {
    text("มีรายละเอียดเพิ่มเติมแนบท้ายใบปะหน้า", 340, 35, 8);
    let continuation = document.addPage([595.28, 841.89]);
    let y = 752;
    const heading = () => {
      text("รายละเอียดเพิ่มเติมใบปะหน้าซองข้อสอบ", left, 800, 15, continuation);
      text(`${data.courseCode} · ซอง ${data.envelopeNo} · ${data.requestNo}`, left, 777, 10, continuation);
    };
    heading();
    for (const entry of overflow) {
      for (const value of wrap(`${entry.label}: ${entry.value}`, font, 11, width)) {
        if (y < 55) { continuation = document.addPage([595.28, 841.89]); heading(); y = 752; }
        text(value, left, y, 11, continuation);
        y -= 18;
      }
      y -= 12;
    }
  }
  const bytes = await document.save();
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
