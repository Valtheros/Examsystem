import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";

type CoverData = {
  requestNo: string;
  courseCode: string;
  courseName: string;
  groupNo: string;
  examDate: string;
  startsAt: string;
  endsAt: string;
  roomCode: string;
  roomName: string;
  building?: string | null;
  studentCount: number;
  printCount: number;
  senderName: string;
  note?: string | null;
  scanUrl: string;
};

function drawField(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  label: string,
  value: string,
  y: number,
) {
  page.drawText(label, { x: 56, y, size: 16, font, color: rgb(0.12, 0.12, 0.12) });
  page.drawText(value, { x: 190, y, size: 16, font, color: rgb(0.02, 0.02, 0.02) });
  page.drawLine({
    start: { x: 185, y: y - 3 },
    end: { x: 535, y: y - 3 },
    thickness: 0.5,
    color: rgb(0.55, 0.55, 0.55),
  });
}

export async function createCoverPdf(data: CoverData) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fontBytes = await readFile(
    path.join(process.cwd(), "public", "fonts", "NotoSansThai.ttf"),
  );
  const font = await document.embedFont(fontBytes, { subset: true });
  const page = document.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderWidth: 2,
    borderColor: rgb(0.05, 0.12, 0.28),
  });
  page.drawText("ใบปะหน้าซองข้อสอบ", {
    x: 175,
    y: height - 88,
    size: 26,
    font,
    color: rgb(0.05, 0.12, 0.28),
  });
  page.drawText("คณะวิทยาศาสตร์", {
    x: 228,
    y: height - 118,
    size: 17,
    font,
  });

  const fields: Array<[string, string]> = [
    ["เลขที่คำขอ", data.requestNo],
    ["รายวิชา", `${data.courseCode} ${data.courseName}`],
    ["กลุ่มเรียน", data.groupNo],
    ["วันสอบ", data.examDate],
    ["เวลาสอบ", `${data.startsAt.slice(0, 5)}–${data.endsAt.slice(0, 5)} น.`],
    ["ห้องสอบ", `${data.roomCode} ${data.roomName}`],
    ["อาคาร", data.building || "-"],
    ["จำนวนผู้เข้าสอบ", `${data.studentCount} คน`],
    ["จำนวนข้อสอบ", `${data.printCount} ชุด (รวมสำรอง 1 ชุด)`],
    ["ผู้ส่งข้อสอบ", data.senderName],
    ["หมายเหตุ", data.note || "-"],
  ];
  fields.forEach(([label, value], index) => {
    drawField(page, font, label, value, height - 170 - index * 42);
  });

  const qrBytes = await QRCode.toBuffer(data.scanUrl, {
    type: "png",
    width: 260,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const qr = await document.embedPng(qrBytes);
  page.drawImage(qr, { x: 56, y: 58, width: 130, height: 130 });
  page.drawText("สแกนเพื่อบันทึกการแจกจ่าย", {
    x: 205,
    y: 125,
    size: 16,
    font,
  });
  page.drawText("ต้องเข้าสู่ระบบด้วยบทบาทเจ้าหน้าที่", {
    x: 205,
    y: 98,
    size: 13,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  const bytes = await document.save();
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
