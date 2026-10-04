"""Create the ERD PNG and a Thai database guide from read-only catalog evidence.

Uses ReportLab + HarfBuzz for embedded TH SarabunPSK and Poppler for rendering.
No database writes, no exports of real application rows, and no exam file reads.
"""
from pathlib import Path
import argparse
import json
import re
import subprocess
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A3, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle, Spacer, PageBreak, KeepTogether
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf"
TMP = ROOT / "tmp/pdfs/database-report"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
CATALOG = json.loads((TMP / "catalog.json").read_text(encoding="utf-8"))
FONT_DIR = ROOT.parent / "outputs/ui-report/assets"
pdfmetrics.registerFont(TTFont("Sarabun", str(FONT_DIR / "THSarabunPSK-Regular.ttf"), shapable=True))
pdfmetrics.registerFont(TTFont("SarabunB", str(FONT_DIR / "THSarabunPSK-Bold.ttf"), shapable=True))
pdfmetrics.registerFontFamily("Sarabun", normal="Sarabun", bold="SarabunB", italic="Sarabun", boldItalic="SarabunB")

NAVY = colors.HexColor("#142c43")
INK = colors.HexColor("#17232e")
MUTED = colors.HexColor("#516170")
RULE = colors.HexColor("#cbd4da")
PALE = colors.HexColor("#f1f5f7")
BLACK = colors.HexColor("#111111")
WHITE = colors.white
DATE = "4 ตุลาคม 2569"
STEM = "exam-database-2026-10-04"
PDF = OUT / f"{STEM}-guide.pdf"
PNG = OUT / f"{STEM}-erd.png"
POPPLER = Path("C:/Users/max64/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe")

TABLES = [
    dict(name="users", schema="better_auth", thai="บัญชีและข้อมูลผู้ใช้", purpose="เป็นข้อมูลกลางของคนที่ใช้ระบบ ระบุว่าเป็นใครและมีบทบาทใด ผู้ดูแลระบบเป็นผู้สร้างบัญชีให้บทบาทอื่น ไม่มีการสมัครเอง", fields="id, username, name, email, role; banned สำหรับปิดบัญชี; must_change_password สำหรับบังคับเปลี่ยนรหัสครั้งแรก; created_by เก็บรหัสผู้สร้าง", reason="รวมข้อมูลตัวตนไว้จุดเดียว งานสอบ ไฟล์ และประวัติอ้างผู้ใช้เดียวกันได้ โดยไม่ต้องคัดลอกข้อมูลบัญชีทั้งชุด", example="U-T01 / อาจารย์กานต์ / username: teacher.kant / role: อาจารย์", caution="ตารางนี้ไม่เก็บรหัสผ่าน รหัสผ่านแบบ hash อยู่ใน accounts และ created_by ไม่มี Foreign Key/self-loop ในฐานข้อมูลจริง"),
    dict(name="sessions", schema="better_auth", thai="การคงสถานะเข้าสู่ระบบ", purpose="เก็บ session ที่ Better Auth ใช้จำว่าผู้ใช้เข้าสู่ระบบแล้ว รวมวันหมดอายุและข้อมูลอุปกรณ์ที่เกี่ยวข้อง", fields="user_id, token, expires_at, ip_address, user_agent; impersonated_by ใช้ระบุผู้ดูแลที่เข้าใช้งานแทน", reason="คนหนึ่งอาจเข้าสู่ระบบจากหลายอุปกรณ์ จึงแยก session ออกจากบัญชี เพื่อยกเลิกหรือหมดอายุเป็นราย session ได้", example="S-01 เป็นของ U-T01 / หมดอายุภายหลัง / token: [ค่าลับ ไม่แสดง]", caution="users 1:N sessions; user_id จำเป็นต้องมี แต่ impersonated_by เป็นข้อมูลประกอบ ไม่ได้มี FK ของตนเอง"),
    dict(name="accounts", schema="better_auth", thai="ข้อมูลสำหรับยืนยันตัวตน", purpose="เก็บข้อมูลวิธีเข้าสู่ระบบที่ Better Auth จัดการ รุ่นนี้ใช้ username/password โดยเก็บ password hash ไม่ใช่รหัสผ่านที่อ่านได้", fields="user_id, issuer, account_id, provider_id, password; มีช่อง provider tokens สำหรับความเข้ากันได้ของ Better Auth", reason="แยกข้อมูลยืนยันตัวตนที่อ่อนไหวออกจาก profile และรองรับผู้ใช้หนึ่งคนผูกหลายวิธียืนยันตัวตนตามโครงสร้างของไลบรารี", example="A-01 → U-T01 / provider_id: credential / password: [HASH]", caution="users 1:N accounts ตาม schema จริง แม้รุ่นนี้ปกติใช้ credential เดียว; issuer + account_id ห้ามซ้ำ"),
    dict(name="verifications", schema="better_auth", thai="โทเคนยืนยันและรีเซ็ตรหัสผ่าน", purpose="เก็บข้อมูลยืนยันแบบมีอายุ เช่น กระบวนการรีเซ็ตรหัสผ่านที่ Better Auth ใช้ ไม่ใช่ตารางบัญชีอีกชุดหนึ่ง", fields="id, identifier, value, expires_at, created_at, updated_at", reason="ข้อมูลชั่วคราวต้องมีวันหมดอายุและ lifecycle ต่างจากข้อมูลผู้ใช้ จึงไม่ควรนำไปปะปนใน users", example="V-01 / identifier: [ตัวระบุสำหรับรีเซ็ต] / value: [ค่าลับ]", caution="ไม่มี FK ไป users โดยตั้งใจ จึงไม่วาดเส้นความสัมพันธ์ที่ฐานข้อมูลไม่ได้บังคับ และไม่เกี่ยวกับ 2FA ในระบบนี้"),
    dict(name="exam_rounds", schema="app", thai="รอบสอบ", purpose="เก็บรอบกลางภาค ปลายภาค หรือรอบอื่น พร้อมปีการศึกษา ภาคเรียน และช่วงที่เปิดให้ส่งข้อสอบ", fields="name, academic_year, semester, submission_starts_on, submission_ends_on, is_active, created_by", reason="แยกขอบเขตของการสอบแต่ละครั้ง วิชาเดียวกันสอบกลางภาคและปลายภาคได้ โดยมีคำขอและกำหนดการคนละรอบ", example="R-01 / ปลายภาค / ปี 2569 / ภาคเรียน 1 / สร้างโดย U-O01", caution="หนึ่งรอบมีหลาย subjects; ชื่อรอบ + ปีการศึกษา + ภาคเรียนต้องไม่ซ้ำกัน"),
    dict(name="subjects", schema="app", thai="รายวิชาและกลุ่มเรียนในรอบสอบ", purpose="เก็บวิชาที่ต้องสอบในรอบนั้น รวมกลุ่มเรียนและอาจารย์ผู้รับผิดชอบ ไม่ใช่ทะเบียนรายวิชาถาวรที่แยกจากรอบสอบ", fields="round_id, course_code, course_name, group_no, instructor_id", reason="ทำให้กำหนดอาจารย์และตารางแยกตามรอบ/กลุ่มได้ และตรวจสิทธิ์ว่าอาจารย์ส่งได้เฉพาะวิชาของตน", example="SUB-01 / R-01 / SCI-101 วิทยาศาสตร์พื้นฐาน / กลุ่ม 1 / U-T01", caution="รอบหนึ่งมีหลายวิชา และผู้ใช้บทบาทอาจารย์หนึ่งคนรับผิดชอบได้หลายวิชา; round_id + course_code + group_no ต้องไม่ซ้ำ"),
    dict(name="rooms", schema="app", thai="ข้อมูลห้องจริง", purpose="เก็บรหัสห้อง ชื่อ อาคาร ความจุ และการเปิดให้ใช้งาน เจ้าหน้าที่ดูแลข้อมูลนี้ แต่ไม่ได้กำหนดจำนวนข้อสอบที่ต้องพิมพ์", fields="code, name, building, capacity, is_active", reason="ใช้ข้อมูลห้องชุดเดียวร่วมกับหลายวิชา/หลายรอบ ลดการกรอกชื่อและความจุซ้ำ และมีจุดอ้างอิงสำหรับตรวจเวลาทับซ้อน", example="ROOM-A / รหัส A101 / อาคาร A / ความจุ 60 คน", caution="ความจุห้องไม่ใช่ค่าเริ่มต้นของจำนวนข้อสอบ ห้องเดียวใช้กับหลายวิชาได้ แต่แอปไม่อนุญาตให้จองเวลาทับซ้อน"),
    dict(name="exam_rooms", schema="app", thai="ตารางกลางวิชาและห้องสอบ", purpose="จับคู่รายวิชากับห้องจริง พร้อมวันและเวลาเริ่ม-สิ้นสุด เป็นข้อมูลการจัดตารางของเจ้าหน้าที่", fields="subject_id, room_id, exam_date, starts_at, ends_at, note; student_count คงไว้เฉพาะข้อมูลเดิม", reason="แก้ความสัมพันธ์ M:N ระหว่าง subjects กับ rooms เพราะหนึ่งวิชาใช้หลายห้อง และหนึ่งห้องใช้หลายวิชาต่างเวลาได้", example="ER-A → SUB-01 + ROOM-A / 12 ต.ค. 2569 / 09:00-12:00", caution="เป็น junction table จริง; จำนวนข้อสอบรุ่นปัจจุบันไม่อ่านจาก student_count ของตารางนี้ เวลาทับซ้อนตรวจและ serialize ฝั่งแอป"),
    dict(name="exam_requests", schema="app", thai="แบบฟอร์มและคำขอจัดพิมพ์", purpose="เก็บคำขอของอาจารย์ สถานะ รายละเอียดการส่ง และแบบฟอร์มออนไลน์แบบมีโครงสร้างใน submission_form", fields="request_no, subject_id, instructor_id, page_count, submission_form, status; submitted_at, locked_at, cancelled_at/cancelled_by", reason="เป็นศูนย์กลางของงานหนึ่งรายการ เชื่อมรายละเอียดห้อง ไฟล์ งานพิมพ์ การแจ้งอีเมล และประวัติสถานะเข้าด้วยกัน", example="REQ-01 → SUB-01 / U-T01 / 6 หน้า / ภาษาไทย / พิมพ์สองหน้า", caution="หนึ่งวิชามีคำขอที่ไม่ยกเลิกได้เพียงหนึ่งรายการ แต่มีประวัติคำขอที่ยกเลิกได้หลายรายการ; original_copy_count เป็นคอลัมน์เดิม ไม่ได้แปลว่าต้องส่งกระดาษ"),
    dict(name="request_rooms", schema="app", thai="รายละเอียดคำขอและจำนวนแยกต่อห้อง", purpose="เก็บ snapshot ห้องและวันเวลาของคำขอ พร้อมยอดอาจารย์ ยอดพิมพ์หลัก และจำนวนสำรองต่อห้อง เพื่อทำซองข้อสอบ", fields="request_id, exam_room_id; room_code/name, exam_date, starts_at/ends_at; student_count, base_copy_count, reserve_count, print_count, sender_name", reason="รักษาข้อมูลที่ใช้กับคำขอ/ซอง ไม่ใช่อ่านห้องสดแล้วทำให้เอกสารเก่าเปลี่ยน เป็นตารางกลางคำขอ-ตารางสอบที่มีรายละเอียด snapshot", example="RR-A / REQ-01 / ER-A / อาจารย์ขอ 50 / หลัก 50 + สำรอง 1 = 51", caution="print_count = base_copy_count + reserve_count; ปรับหลักไม่เขียนทับยอดอาจารย์; request_id + exam_room_id ห้ามซ้ำ; qr_token เป็นคอลัมน์เก่า ไม่ใช้สแกน"),
    dict(name="exam_files", schema="app", thai="ข้อมูลกำกับและเวอร์ชันไฟล์ข้อสอบ", purpose="เก็บชื่อไฟล์ ขนาด ชนิด checksum ผู้ส่ง และรุ่นของไฟล์ ข้อมูล PDF จริงอยู่ใน private MinIO ไม่ได้เก็บเป็น BLOB ใน PostgreSQL", fields="request_id, uploaded_by, kind, original_file_name, storage_key, size_bytes, sha256, version, uploaded_at", reason="เปลี่ยนไฟล์โดยสร้างรุ่นใหม่และเก็บของเดิมไว้ได้ แยกต้นฉบับอาจารย์จากไฟล์พร้อมพิมพ์ที่หน่วยโสตอาจเตรียม", example="FILE-V2 → REQ-01 / ต้นฉบับ / version 2 / exam-v2.pdf / key: [ตัวอย่าง]", caution="request_id + kind + version ห้ามซ้ำ; PDF สูงสุด 104,857,600 bytes (100 MiB ตามขีดจำกัดโค้ด) เก็บ hash ไว้ตรวจความครบถ้วน ไม่ใช่การเข้ารหัสไฟล์"),
    dict(name="cover_sheets", schema="app", thai="ใบปะหน้าซองที่สร้างแล้ว", purpose="เก็บ metadata ของ PDF ใบปะหน้าต่อห้อง พร้อมผู้สร้าง เวอร์ชันเอกสาร และรุ่นแผนพิมพ์ที่ใช้สร้าง", fields="request_room_id, storage_key, sha256, version, generated_by, print_revision, generated_at", reason="ห้องหนึ่งต้องมีใบปะหน้าของตนเอง และอาจสร้างใหม่เมื่อแผนเปลี่ยน โดยต้องเก็บไฟล์รุ่นเก่าไว้ตรวจย้อนหลัง", example="COVER-A-V2 → RR-A / version 2 / print_revision 2 / สร้างโดย U-P01", caution="request_rooms 1:N cover_sheets เพราะหลายเวอร์ชัน; ไม่มีช่องจำนวนพิมพ์ซ้ำในตารางนี้ จำนวนบน PDF มาจาก request_rooms และแผนพิมพ์"),
    dict(name="print_jobs", schema="app", thai="งานและแผนพิมพ์ของคำขอ", purpose="เก็บงานพิมพ์หลักของคำขอ ไฟล์ที่เลือก ยอดรวม ผู้ดำเนินการ รุ่นแผน และเวลาเริ่ม/เสร็จ", fields="request_id, operator_id, selected_exam_file_id, total_copies, revision, confirmed_at, status, started_at, completed_at", reason="แยกการเตรียมงานและการพิมพ์จริงออกจากแบบฟอร์มอาจารย์ มี revision เพื่อกันเริ่มพิมพ์โดยใช้ใบปะหน้ารุ่นเก่า", example="JOB-01 → REQ-01 / FILE-V2 / revision 1 / ยอดรวม 92 ชุด", caution="request_id มี UNIQUE จึงเป็นคำขอ 1:1 งานพิมพ์สูงสุด ไม่ใช่หนึ่งงานต่อห้อง; selected_exam_file_id เป็น nullable สำหรับข้อมูลเดิมและยังไม่มี UNIQUE"),
    dict(name="notifications", schema="app", thai="คิวและผลการส่งอีเมล", purpose="เก็บข้อความ อีเมลปลายทาง และผลส่ง Pending/Sent/Failed รวมจำนวนครั้งที่พยายามส่งและข้อผิดพลาด", fields="user_id, request_id, type, subject, message, email_to, delivery_status, attempts, last_error, sent_at", reason="อีเมลอาจส่งไม่สำเร็จ แต่ไม่ควรทำให้งานพิมพ์ย้อนกลับ สามารถดูเหตุผลและส่งใหม่ได้แยกจากธุรกรรมหลัก", example="NOTI-01 → REQ-01 + U-T01 / พิมพ์เสร็จ / Sent", caution="user_id และ request_id อาจว่างได้ เช่น อีเมลสร้างบัญชีไม่มีคำขอ; ไม่มี read_at และไม่รู้ว่าผู้รับเปิดอ่านเมื่อไร"),
    dict(name="request_status_history", schema="app", thai="ประวัติเปลี่ยนสถานะคำขอ", purpose="เก็บสถานะก่อน-หลัง ผู้ทำ เวลา และเหตุผลแต่ละครั้ง ใช้ตอบว่าคำขอเดินผ่านขั้นตอนใดมาบ้าง", fields="request_id, from_status, to_status, actor_id, actor_username_snapshot, actor_role_snapshot, reason, created_at", reason="status ในคำขอเป็นสถานะปัจจุบัน แต่ประวัติหลายแถวทำให้ตรวจเส้นทาง ส่งกลับแก้ไข และเวลาการดำเนินงานได้", example="H-03 / REQ-01 / รอตรวจสอบ → ตัดข้อสอบ / ผู้ทำ U-P01", caution="เก็บ snapshot ชื่อบัญชี/บทบาทไว้ เมื่อบัญชีถูกลบ actor_id กลายเป็น NULL ได้ แต่ประวัติยังอ่านได้"),
    dict(name="audit_logs", schema="app", thai="ประวัติเหตุการณ์และการตรวจสอบ", purpose="เก็บเหตุการณ์สำคัญทั้งระบบ เช่น เข้าสู่ระบบ ดาวน์โหลด ปรับจำนวน และรีเซ็ต พร้อมเป้าหมายและรายละเอียด JSON", fields="actor_id, actor_username_snapshot, actor_role_snapshot, action, target_type, target_id, metadata, ip_address, user_agent, created_at", reason="ครอบคลุมมากกว่าการเปลี่ยนสถานะคำขอ และยังเก็บประวัติได้หลังลบบัญชีหรือ Factory Reset", example="LOG-01 / actor U-P01 / PRINT_PLAN_UPDATED / target_type: exam_request / target_id: REQ-01", caution="target_id เป็น polymorphic reference ไม่ใช่ FK ไป exam_requests จึงไม่วาดเส้น FK ที่ไม่มีจริง ประวัติรับมอบ/แจกจ่ายเก่าถ้ามีถูก archive ไว้ที่นี่"),
]

def normalize(text):
    value = text.replace("→", " -> ").replace("–", "-").replace("—", "-").replace("≥", ">=").replace("≤", "<=")
    supported = pdfmetrics.getFont("Sarabun").face.charToGlyph
    missing = sorted({ch for ch in value if not ch.isspace() and ord(ch) not in supported})
    if missing:
        raise ValueError(f"Font does not support: {missing}")
    return value

def para(c, text, x, top, width, size=17, leading=21, color=INK, bold=False, max_height=None):
    style = ParagraphStyle("body", fontName="SarabunB" if bold else "Sarabun", fontSize=size, leading=leading, textColor=color, wordWrap="CJK", shaping=1, allowWidows=0, allowOrphans=0)
    p = Paragraph(escape(normalize(text)).replace("\n", "<br/>"), style)
    _, height = p.wrap(width, 2000)
    if max_height is not None and height > max_height:
        raise ValueError(f"Text exceeds reserved space: {text[:75]} ({height} > {max_height})")
    p.drawOn(c, x, top-height)
    return top-height

def txt(c, x, y, text, size=18, bold=False, color=INK, center=False):
    text = normalize(text)
    c.setFillColor(color)
    c.setFont("SarabunB" if bold else "Sarabun", size)
    if center:
        c.drawCentredString(x, y, text, shaping=True)
    else:
        c.drawString(x, y, text, shaping=True)

def rule(c, x, y, width, color=RULE, weight=0.65):
    c.setStrokeColor(color); c.setLineWidth(weight); c.line(x,y,x+width,y)

def footer(c, number, section, page_size=A4):
    w,h=page_size
    rule(c,40,39,w-80)
    txt(c,40,24,"ระบบจัดพิมพ์ข้อสอบ | โครงสร้างที่ตรวจจากฐานข้อมูลจริง",12,color=MUTED)
    c.setFont("Sarabun",12); c.setFillColor(MUTED)
    c.drawRightString(w-40,24,f"{section}  /  {number:02d}",shaping=True)

def page_head(c, eyebrow, heading, number, section, size=A4):
    w,h=size
    txt(c,42,h-43,eyebrow,12,bold=True,color=MUTED)
    txt(c,42,h-76,heading,27,bold=True,color=NAVY)
    rule(c,42,h-91,w-84)
    footer(c,number,section,size)
    return h-110

# English labels and cardinalities are verified against catalog Foreign Keys.
RELS = [
    ("subjects","round_id","CONTAINS","รอบหนึ่งรวมหลายวิชา เพื่อแยกงานแต่ละครั้งและแต่ละภาคเรียน"),
    ("exam_rooms","subject_id","HAS_SCHEDULE","วิชาหนึ่งจัดได้หลายห้อง/ตาราง ไม่ต้องสร้างชื่อวิชาซ้ำทุกห้อง"),
    ("exam_rooms","room_id","USES","ห้องเดียวถูกใช้ได้หลายวิชาต่างเวลา ความจุและชื่อห้องมาจากข้อมูลกลาง"),
    ("exam_requests","subject_id","HAS_REQUEST","มีประวัติคำขอของวิชาได้หลายรายการ แต่ partial UNIQUE จำกัดรายการที่ไม่ยกเลิกไว้หนึ่งรายการ"),
    ("request_rooms","request_id","INCLUDES","คำขอหนึ่งมีหลายห้อง จึงแยกยอดข้อสอบและ snapshot ของแต่ละซองได้"),
    ("request_rooms","exam_room_id","SNAPSHOTS","ชี้กลับตารางที่จัดไว้ และคงข้อมูล ณ การสร้างคำขอเพื่อไม่เปลี่ยนซองเก่าย้อนหลัง"),
    ("exam_files","request_id","HAS_FILE","คำขอเดียวแนบหลายรุ่นหรือหลายชนิดไฟล์ได้ เก็บของเก่าโดยไม่เขียนทับ"),
    ("cover_sheets","request_room_id","GENERATES","รายละเอียดห้องหนึ่งมีใบปะหน้าหลายเวอร์ชันตามการปรับแผน"),
    ("print_jobs","request_id","HAS_PRINT_JOB","มีงานหลักหนึ่งงานต่อคำขอ รวมทุกห้องในงานนั้น request_id มี UNIQUE"),
    ("print_jobs","selected_exam_file_id","SELECTS","เก็บว่าใช้ไฟล์ใดพิมพ์ ช่องนี้ยังไม่มี UNIQUE และเป็น NULL ได้ แอปตรวจว่าไฟล์เป็นของคำขอเดียวกัน"),
    ("notifications","request_id","TRIGGERS","หนึ่งคำขอส่งอีเมลได้หลายเหตุการณ์ และอีเมลที่ไม่เกี่ยวกับคำขอปล่อย FK นี้ว่างได้"),
    ("request_status_history","request_id","HAS_STATUS","หนึ่งคำขอเปลี่ยนสถานะหลายครั้ง จำเป็นต้องมีประวัติหลายแถว"),
    ("sessions","user_id","HAS_SESSION","ผู้ใช้คนเดียวมี session หลายอุปกรณ์หรือหลายครั้งได้"),
    ("accounts","user_id","HAS_ACCOUNT","ข้อมูลตัวตนแยกจากวิธีเข้าสู่ระบบ โครงสร้างรองรับหลาย credential/provider"),
    ("exam_rounds","created_by","CREATES","เก็บว่าเจ้าหน้าที่คนใดเป็นผู้สร้างรอบสอบ เพื่อรับผิดชอบและตรวจย้อนหลัง"),
    ("subjects","instructor_id","TEACHES","อาจารย์คนหนึ่งรับผิดชอบหลายวิชา และใช้ข้อมูลนี้ตรวจสิทธิ์ของอาจารย์"),
    ("exam_requests","instructor_id","SUBMITS","เก็บเจ้าของคำขอโดยตรง เพื่อกรองรายการและตรวจสิทธิ์ก่อนแก้ไขหรือส่ง"),
    ("exam_requests","cancelled_by","CANCELS","เก็บผู้ยกเลิกเฉพาะเมื่อมีการยกเลิก ไม่ใช่เจ้าของคำขออีกแบบหนึ่ง"),
    ("exam_files","uploaded_by","UPLOADS","เก็บว่าอาจารย์หรือหน่วยโสตคนใดอัปโหลดไฟล์แต่ละรุ่น"),
    ("cover_sheets","generated_by","GENERATES","ระบุหน่วยโสตผู้สร้างใบปะหน้าของแต่ละรุ่น"),
    ("print_jobs","operator_id","OPERATES","ระบุหน่วยโสตผู้รับผิดชอบงานพิมพ์หนึ่งงาน ผู้ใช้คนเดียวทำได้หลายงาน"),
    ("notifications","user_id","RECEIVES","ผู้ใช้คนเดียวรับอีเมลได้หลายรายการ เก็บ email_to เป็น snapshot แม้บัญชีถูกลบ"),
    ("request_status_history","actor_id","CHANGES","แยกคนที่เปลี่ยนสถานะแต่ละครั้งจากเจ้าของคำขอ และรักษาชื่อ/บทบาท snapshot"),
    ("audit_logs","actor_id","PERFORMS","ผู้ใช้หนึ่งคนทำหลายเหตุการณ์ และ Audit Log คงไว้ได้เมื่อบัญชีต้นทางถูกลบ"),
]
FK = {(r["child"],r["column_name"]):r for r in CATALOG["foreignKeys"]}
assert set(FK)=={(r[0],r[1]) for r in RELS}, "Every FK must be explained exactly once"
assert {t["name"] for t in TABLES}=={t["table_name"] for t in CATALOG["tables"] if t["table_schema"]!="drizzle"}
assert any("(request_id)" in r["indexdef"] and "UNIQUE" in r["indexdef"] for r in CATALOG["indexes"] if r["tablename"]=="print_jobs")
assert not any(r["parent"]=="users" and r["child"]=="users" for r in FK.values())

DW,DH = 3000,3200
NODES = {
    "exam_rounds":(320,315), "subjects":(1060,315), "exam_rooms":(1800,315), "rooms":(2540,315),
    "exam_files":(320,755), "exam_requests":(1060,755), "request_rooms":(1800,755), "cover_sheets":(2540,755),
    "print_jobs":(320,1235), "request_status_history":(1060,1235), "notifications":(1800,1235),
    "users":(320,1635), "sessions":(1060,1635), "accounts":(1800,1635), "verifications":(2540,1635),
}
DIAGRAM_LABEL_BOXES=[]
DIAGRAM_LINES=[]

def dtext(c,x,y,text,size=29,bold=False,center=False):
    txt(c,x,DH-y,text,size,bold,BLACK,center)

def dline(c,points):
    c.setStrokeColor(BLACK);c.setLineWidth(2.6)
    p=c.beginPath();p.moveTo(points[0][0],DH-points[0][1])
    for x,y in points[1:]:p.lineTo(x,DH-y)
    c.drawPath(p)
    for a,b in zip(points,points[1:]): DIAGRAM_LINES.append((a,b))

def node(c,name,x,y,w=380,h=108,subtitle=None,size=35):
    c.setFillColor(WHITE);c.setStrokeColor(BLACK);c.setLineWidth(2.9)
    c.roundRect(x-w/2,DH-y-h/2,w,h,7,fill=1,stroke=1)
    size = min(size, 35*w/(pdfmetrics.stringWidth(name,"SarabunB",35)+35))
    dtext(c,x,y-7,name,size,True,True)
    if subtitle is None:subtitle=next(t["thai"] for t in TABLES if t["name"]==name)
    dtext(c,x,y+30,subtitle,27,False,True)

def diamond(c,x,y,label,w=260,h=114):
    c.setFillColor(WHITE);c.setStrokeColor(BLACK);c.setLineWidth(2.6)
    p=c.beginPath();p.moveTo(x-w/2,DH-y);p.lineTo(x,DH-y+h/2);p.lineTo(x+w/2,DH-y);p.lineTo(x,DH-y-h/2);p.close()
    c.drawPath(p,fill=1,stroke=1)
    size=min(25, 230/(max(pdfmetrics.stringWidth(label,"Sarabun",1),1)))
    dtext(c,x,y+8,label,size,False,True)

def cardinal(c,x,y,value):
    # Labels have white underlays and at least 10 units clear of line center.
    size=29
    w=pdfmetrics.stringWidth(value,"SarabunB",size)+16
    c.setFillColor(WHITE);c.rect(x-w/2,DH-y-11,w,35,fill=1,stroke=0)
    dtext(c,x,y+8,value,size,True,True)
    DIAGRAM_LABEL_BOXES.append((x-w/2,y-24,x+w/2,y+11))

def horizontal(c,left,right,label,lcard="1",rcard="N"):
    x1,y=NODES[left];x2,_=NODES[right]
    dline(c,[(x1+190,y),(x2-190,y)])
    diamond(c,(x1+x2)/2,y,label)
    cardinal(c,x1+220,y-29,lcard);cardinal(c,x2-220,y-29,rcard)

def vertical(c,top,bottom,label,tcard="1",bcard="N"):
    x,y1=NODES[top];_,y2=NODES[bottom]
    dline(c,[(x,y1+54),(x,y2-54)])
    diamond(c,x,(y1+y2)/2,label)
    cardinal(c,x+30,y1+86,tcard);cardinal(c,x+30,y2-90,bcard)

def draw_diagram(c):
    dtext(c,90,75,"ERD | ระบบจัดพิมพ์ข้อสอบ",52,True)
    dtext(c,90,119,f"16 ตารางของระบบ / 24 Foreign Keys / ตรวจจาก PostgreSQL วันที่ {DATE}",32)
    dtext(c,90,192,"A  ความสัมพันธ์งานสอบและการพิมพ์ (schema app)",35,True)
    horizontal(c,"exam_rounds","subjects","CONTAINS")
    horizontal(c,"subjects","exam_rooms","HAS_SCHEDULE")
    horizontal(c,"exam_rooms","rooms","USES","N","1")
    horizontal(c,"exam_files","exam_requests","HAS_FILE","N","1")
    horizontal(c,"exam_requests","request_rooms","INCLUDES")
    horizontal(c,"request_rooms","cover_sheets","GENERATES")
    vertical(c,"subjects","exam_requests","HAS_REQUEST")
    vertical(c,"exam_rooms","request_rooms","SNAPSHOTS")
    vertical(c,"exam_files","print_jobs","SELECTED_FOR")
    vertical(c,"exam_requests","request_status_history","HAS_STATUS")
    dline(c,[(960,809),(960,893),(640,893),(640,1235),(510,1235)])
    diamond(c,640,1050,"HAS_PRINT_JOB",w=230)
    cardinal(c,991,851,"1");cardinal(c,553,1204,"1")
    dline(c,[(1180,809),(1180,916),(1800,916),(1800,1181)])
    diamond(c,1800,1045,"TRIGGERS")
    cardinal(c,1211,859,"1");cardinal(c,1831,1144,"N")
    for name in list(NODES)[:11]:node(c,name,*NODES[name])
    dtext(c,90,1380,"หมายเหตุ: 1 = สูงสุดหนึ่งรายการ; N = หลายรายการ ช่องที่ไม่จำเป็นและ UNIQUE อธิบายใน PDF",29)
    dtext(c,90,1422,"print_jobs ผูกคำขอ ไม่ได้ผูก request_rooms | audit_logs ไม่มี FK ไปคำขอ | ไม่มีตารางรับมอบ/แจกจ่าย",29)
    c.setStrokeColor(BLACK);c.setLineWidth(1);c.line(90,DH-1470,2910,DH-1470)
    dtext(c,90,1532,"B  บัญชีและการยืนยันตัวตน (schema better_auth)",35,True)
    horizontal(c,"users","sessions","HAS_SESSION")
    dline(c,[(320,1689),(320,1867),(1800,1867),(1800,1689)])
    diamond(c,1800,1795,"HAS_ACCOUNT")
    cardinal(c,350,1735,"1");cardinal(c,1831,1728,"N")
    for name in ["users","sessions","accounts","verifications"]:node(c,name,*NODES[name])
    dtext(c,2540,1738,"ไม่มี Foreign Key ไป users",28,False,True)
    dtext(c,2540,1780,"ใช้ identifier/value ของ Better Auth",28,False,True)
    c.setStrokeColor(BLACK);c.line(90,DH-1920,2910,DH-1920)
    dtext(c,90,1980,"C  ผู้ใช้กับงานต่าง ๆ (แสดง users ซ้ำเพื่อให้อ่านเส้นง่าย; เป็นตารางเดียวกัน)",35,True)
    actor_rels=RELS[14:]
    assert len(actor_rels)==10
    for i,(child,col,label,_) in enumerate(actor_rels):
        row=i//2;column=i%2;x=90+column*1460;y=2070+row*190
        node(c,"users",x+140,y,w=280,h=90,subtitle="ตารางเดียวกับส่วน B",size=32)
        node(c,child,x+970,y,w=490,h=90,size=32)
        dline(c,[(x+280,y),(x+725,y)])
        diamond(c,x+502,y,label,w=268,h=90)
        cardinal(c,x+312,y-27,"1");cardinal(c,x+692,y-27,"N")
        f=FK[(child,col)]
        dtext(c,x+285,y+81,f"FK: {child}.{col}"+("  (NULL ได้)" if not f["required"] else ""),28)
    dtext(c,90,3085,"สี่เหลี่ยม = ตาราง | ข้าวหลามตัด = ความสัมพันธ์ | ใช้ชื่อจริงในฐานข้อมูล ไม่มี attribute ในภาพเพื่อให้อ่านง่าย",29)
    dtext(c,90,3130,"ตารางภายใน drizzle.__drizzle_migrations ไม่ใช่ตารางธุรกิจ และไม่นับรวมใน 16 ตารางนี้",29)

def create_diagram():
    diagram=TMP/"erd-vector.pdf"
    c=canvas.Canvas(str(diagram),pagesize=(DW,DH),pageCompression=1,initialFontName="Sarabun")
    c.setTitle("Exam system ERD - inspected PostgreSQL schema")
    draw_diagram(c);c.showPage();c.save()
    # Automated geometry check: no cardinality box intersects any relationship segment.
    for x0,y0,x1,y1 in DIAGRAM_LABEL_BOXES:
        for (ax,ay),(bx,by) in DIAGRAM_LINES:
            if ax==bx and x0 < ax < x1 and max(min(ay,by),y0)<min(max(ay,by),y1):
                raise AssertionError("A cardinality label overlaps a vertical line")
            if ay==by and y0 < ay < y1 and max(min(ax,bx),x0)<min(max(ax,bx),x1):
                raise AssertionError("A cardinality label overlaps a horizontal line")
    subprocess.run([str(POPPLER),"-singlefile","-r","72","-png",str(diagram),str(PNG.with_suffix(""))],check=True)
    return diagram

def table_section(c,table,top,index):
    x=42;width=A4[0]-84
    txt(c,x,top-9,f"{index:02d}  {table['schema']}.{table['name']}",23,True,NAVY)
    txt(c,x,top-31,table["thai"],19,True)
    y=top-46
    for label,key in [("เก็บอะไร","purpose"),("ข้อมูลหลัก","fields"),("ทำไมต้องแยก","reason")]:
        txt(c,x,y-13,label,15,True,color=MUTED)
        y=para(c,table[key],x+91,y,width-91,size=16,leading=19,max_height=64)-7
    # Fictional data strip: no real IDs, email, secrets, or exam contents.
    p=Paragraph(escape(normalize(table["example"])),ParagraphStyle("example",fontName="Sarabun",fontSize=16,leading=19,textColor=INK,wordWrap="CJK",shaping=1))
    _,hh=p.wrap(width-24,1000)
    c.setFillColor(PALE);c.rect(x,y-hh-31,width,hh+27,fill=1,stroke=0)
    txt(c,x+12,y-17,"ตัวอย่างสมมติ",14,True,color=MUTED);p.drawOn(c,x+12,y-hh-25)
    y=y-hh-42
    y=para(c,"ควรรู้: "+table["caution"],x,y,width,size=15,leading=18,color=MUTED,max_height=62)
    return y

def callout(c,title,body,x,top,width):
    c.setStrokeColor(NAVY);c.setLineWidth(2.4);c.line(x,top,x,top-68)
    txt(c,x+12,top-17,title,19,True,NAVY)
    return para(c,body,x+12,top-29,width-12,size=17,leading=21)

def diagram_page(vector,page_number,crop_top,crop_bottom,title,subtitle):
    size=landscape(A3);w,h=size
    temp=TMP/f"diagram-{page_number}.pdf"
    c=canvas.Canvas(str(temp),pagesize=size,pageCompression=1,initialFontName="Sarabun")
    page_head(c,"แผนภาพความสัมพันธ์ / ERD",title,page_number,"ERD",size)
    txt(c,42,h-111,subtitle,16,color=MUTED)
    c.showPage();c.save()
    base=PdfReader(str(temp)).pages[0]
    artwork=PdfReader(str(vector)).pages[0]
    # Clip in the source page before merging so the other panel cannot spill.
    from pypdf.generic import RectangleObject
    artwork.cropbox=RectangleObject([0,DH-crop_bottom,DW,DH-crop_top])
    scale=min((w-84)/DW,(h-175)/(crop_bottom-crop_top))
    from pypdf import Transformation
    tx=42;ty=h-145-(DH-crop_top)*scale
    base.merge_transformed_page(artwork,Transformation().scale(scale).translate(tx,ty),expand=False)
    writer=PdfWriter();writer.add_page(base)
    with open(temp,"wb") as output:writer.write(output)
    return temp

def create_report(vector):
    body=TMP/"guide-body.pdf"
    c=canvas.Canvas(str(body),pagesize=A4,pageCompression=1,initialFontName="Sarabun")
    c.setTitle("คู่มือฐานข้อมูลระบบจัดพิมพ์ข้อสอบ - 4 ตุลาคม 2569")
    c.setAuthor("ระบบจัดพิมพ์ข้อสอบ")
    w,h=A4
    # Page 1 - editorial cover with useful reading guide, not decorative filler.
    c.setFillColor(NAVY);c.rect(0,h-274,w,274,fill=1,stroke=0)
    txt(c,43,h-48,"DATABASE GUIDE / VERIFIED SCHEMA",14,True,WHITE)
    txt(c,43,h-109,"ฐานข้อมูล",47,True,WHITE)
    txt(c,43,h-157,"ระบบจัดพิมพ์ข้อสอบ",35,True,WHITE)
    txt(c,43,h-199,f"ตรวจจากฐานข้อมูลจริง / {DATE}",19,color=WHITE)
    txt(c,43,h-234,"PostgreSQL 17 + Better Auth + MinIO",17,color=WHITE)
    txt(c,43,h-335,"16",52,True,NAVY);txt(c,122,h-310,"ตารางของระบบ",21,True)
    txt(c,122,h-339,"บัญชี 4 ตาราง + ข้อมูลธุรกิจ 12 ตาราง",17,color=MUTED)
    txt(c,352,h-335,"24",52,True,NAVY);txt(c,428,h-310,"Foreign Keys",19,True)
    txt(c,428,h-339,"ตรวจจาก constraints",15,color=MUTED)
    rule(c,43,h-364,w-86)
    y=para(c,"คู่มือนี้อธิบายว่าตารางแต่ละตัวเก็บอะไร ทำไมต้องแยก และเชื่อมกันอย่างไร ภาพใช้สัญลักษณ์สี่เหลี่ยมกับข้าวหลามตัดแบบตัวอย่าง ส่วนชื่อและข้อจำกัดยึดฐานข้อมูลที่ใช้งานอยู่ ไม่ใช่ ERD รุ่นก่อน",43,h-385,w-86,size=19,leading=24)
    y-=25;txt(c,43,y,"อ่านส่วนที่ต้องการได้ทันที",22,True,NAVY);y-=22
    for label,pages in [("ภาพ ERD และคำอธิบายสัญลักษณ์","หน้า 2-4"),("หน้าที่ของทั้ง 16 ตาราง พร้อมตัวอย่าง","หน้า 5-12"),("Foreign Key ครบ 24 จุดและเหตุผล","หน้า 13-15"),("ตัวอย่างหนึ่งวิชา สองห้อง หลายเวอร์ชัน","หน้า 16-17")]:
        txt(c,43,y,label,18);c.setFont("SarabunB",18);c.drawRightString(w-43,y,pages,shaping=True);y-=32
    y-=12;para(c,"ข้อมูลตัวอย่างทั้งหมดเป็นข้อมูลสมมติ รหัสสั้น เช่น REQ-01 ใช้เพื่ออธิบายเท่านั้น ไม่ใช่ UUID ที่นำไป INSERT ได้โดยตรง ไม่มีการอ่านข้อมูลบัญชีจริง โทเคน รหัสผ่าน หรือเนื้อหาข้อสอบจริงมาใส่เอกสาร",43,y,w-86,size=15,leading=18,color=MUTED)
    footer(c,1,"ภาพรวม");c.showPage()
    # Placeholder pages; replaced with sharp vector artwork on final merge.
    for _ in range(2):c.showPage()
    y=page_head(c,"01 / วิธีอ่านโครงสร้าง","อ่านความสัมพันธ์ให้ตรงฐานข้อมูล",4,"สัญลักษณ์และกฎ")
    blocks=[
        ("1 และ N บอกจำนวนสูงสุด","1:N หมายถึงหนึ่งแถวฝั่งต้นทางถูกอ้างได้หลายแถวฝั่งปลายทาง ส่วน 1:1 ในงานพิมพ์เกิดจาก UNIQUE ของ print_jobs.request_id รูปไม่ใช้ 0..1; บางคำขอยังไม่มีงานพิมพ์ได้ก่อนรับงาน และ FK ที่ NULL ได้จะระบุในรายละเอียด"),
        ("ตารางกลาง M:N ที่สำคัญ","subjects กับ rooms เป็น M:N ผ่าน exam_rooms: วิชาหนึ่งใช้หลายห้อง ห้องหนึ่งใช้หลายวิชาต่างเวลา ส่วน request_rooms เชื่อมคำขอกับ exam_rooms พร้อม snapshot และยอดรายห้อง จึงไม่ใช่ตารางซ้ำที่ตัดทิ้งได้"),
        ("แยกค่าที่เป็นข้อมูลจริง กับข้อกำหนดของแอป","Foreign Key ตรวจว่ารหัสปลายทางมีอยู่ แต่ไม่ได้บังคับบทบาทหรือตรวจห้องเวลาทับซ้อนเอง แอปต้องตรวจอาจารย์เจ้าของวิชา หน่วยโสตผู้ดำเนินการ ตารางทับซ้อน และไฟล์ที่เลือกอยู่ในคำขอเดียวกัน"),
        ("Subject → Request มีเงื่อนไขเพิ่มเติม","ประวัติวิชาหนึ่งมีหลายคำขอได้ แต่ unique index ที่มีเงื่อนไข cancelled_at IS NULL อนุญาตคำขอที่ไม่ยกเลิกเพียงหนึ่งรายการ ไม่ได้หมายความว่าสร้างหลายคำขอพร้อมกันได้"),
        ("Snapshot และเวอร์ชันทำหน้าที่ต่างกัน","request_rooms คงรายละเอียดห้องและยอดของคำขอ ส่วน exam_files/cover_sheets เก็บไฟล์แต่ละรุ่น และ print_jobs.revision บอกรุ่นของแผนพิมพ์ ไม่ใช่เลขเวอร์ชัน PDF ตัวเดียวกัน"),
        ("ไม่มีเส้นที่ฐานข้อมูลไม่ได้บังคับ","verifications ไม่มี FK ไป users; users.created_by และ sessions.impersonated_by ไม่มี FK; audit_logs.target_id เป็นรหัสเป้าหมายแบบหลายชนิด ไม่ใช่ FK ไป exam_requests จึงไม่วาด self-loop หรือเส้นปลอม"),
    ]
    for heading,text in blocks:
        txt(c,43,y-16,heading,20,True,NAVY)
        y=para(c,text,43,y-29,w-86,size=17,leading=21)-19
    footer(c,4,"สัญลักษณ์และกฎ");c.showPage()
    # Pages 5-12 - two related tables per page, all 16 tables covered.
    for pair in range(8):
        number=5+pair
        y=page_head(c,"02 / ตารางเก็บข้อมูล","หน้าที่ของตารางและตัวอย่าง",number,"ตาราง")
        end=table_section(c,TABLES[pair*2],y,1+pair*2)
        if end<450:raise ValueError(f"Table section too tall: {TABLES[pair*2]['name']} -> {end}")
        rule(c,42,439,w-84)
        end=table_section(c,TABLES[pair*2+1],420,2+pair*2)
        if end<66:raise ValueError(f"Table section hits footer: {TABLES[pair*2+1]['name']} -> {end}")
        c.showPage()
    # Pages 13-15 - 24 physical FKs, each explained exactly once.
    for group in range(3):
        number=13+group
        y=page_head(c,"03 / Foreign Key ครบทุกจุด",f"ความสัมพันธ์ {group*8+1:02d}-{group*8+8:02d} จาก 24 จุด",number,"ความสัมพันธ์")
        for j,(child,col,label,why) in enumerate(RELS[group*8:group*8+8],start=group*8+1):
            fk=FK[(child,col)];card="1:1" if (child,col)==("print_jobs","request_id") else "1:N"
            txt(c,42,y-12,f"{j:02d}  {fk['parent']}  {card}  {child}  /  {label}",18,True,NAVY)
            y=para(c,f"FK: {fk['child_schema']}.{child}.{col} → {fk['parent_schema']}.{fk['parent']}.{fk['parent_column']}"+(" | จำเป็นต้องมี" if fk["required"] else " | NULL ได้"),42,y-21,w-84,size=14,leading=16,color=MUTED)
            y=para(c,why,42,y-6,w-84,size=16,leading=19)-8
            rule(c,42,y,w-84);y-=8
        if y<60:raise ValueError(f"Relationships overflow footer on page {number}: {y}")
        c.showPage()
    # Page 16 - concrete, consistent joins from setup to submission.
    y=page_head(c,"04 / ตัวอย่างตลอดกระบวนการ","หนึ่งวิชา สองห้อง ส่งข้อสอบออนไลน์",16,"ตัวอย่าง")
    y=para(c,"ตัวอย่างสมมติ: สอบปลายภาค ปี 2569 ภาคเรียน 1 วิชา SCI-101 กลุ่ม 1 มีผู้เข้าสอบ 90 คน เจ้าหน้าที่จัดสองห้อง อาจารย์ระบุยอดแยกห้อง แล้วหน่วยโสตเตรียมพิมพ์",42,y,w-84,size=18,leading=23)-20
    steps=[
        ("1  ผู้ดูแลระบบสร้างคน","users: U-O01 เจ้าหน้าที่, U-T01 อาจารย์, U-P01 หน่วยโสต\naccounts แยก hash สำหรับเข้าสู่ระบบ; sessions เกิดเมื่อเข้าสู่ระบบ"),
        ("2  เจ้าหน้าที่จัดรอบ วิชา และห้อง","exam_rounds R-01 → subjects SUB-01\nrooms ROOM-A จุ 60 คน / ROOM-B จุ 45 คน\nexam_rooms ER-A และ ER-B ผูก SUB-01 กับสองห้อง เวลา 09:00-12:00"),
        ("3  อาจารย์ส่งคำขอและจำนวน","exam_requests REQ-01: submission_form ระบุภาษาไทย พิมพ์สองหน้า และเบอร์ติดต่อสมมติ\nrequest_rooms RR-A ขอ 50 ชุด / RR-B ขอ 40 ชุด ไม่ใช่ 60/45 ตามความจุห้อง"),
        ("4  เก็บและเลือกไฟล์ให้ตรวจย้อนหลังได้","exam_files FILE-V1 และ FILE-V2 เป็นต้นฉบับของ REQ-01\nไฟล์จริงอยู่ MinIO; DB เก็บ storage_key กับ checksum\nหน่วยโสตเลือก FILE-V2 ใน print_jobs JOB-01 โดยไม่ต้องอัปโหลดซ้ำ"),
        ("5  ยืนยันแผน พิมพ์ และจบงาน","cover_sheets สร้างแยก RR-A/RR-B ตามรุ่นแผน\nrequest_status_history เก็บการเปลี่ยนสถานะ; audit_logs เก็บเหตุการณ์; notifications เก็บผลอีเมล\nงานจบที่ พิมพ์เสร็จแล้ว การนำซองไปส่งทำภายนอกระบบ"),
    ]
    for heading,text in steps:
        txt(c,42,y-15,heading,20,True,NAVY)
        y=para(c,text,60,y-29,w-102,size=17,leading=21)-20
    if y<60:raise ValueError("Workflow example overflow")
    c.showPage()
    # Page 17 - quantitative examples and important boundaries.
    y=page_head(c,"04 / จำนวน เวอร์ชัน และข้อจำกัด","ตามรอยยอดพิมพ์และใบปะหน้า",17,"ตัวอย่างและแหล่งอ้างอิง")
    txt(c,42,y-15,"ก่อนปรับแผน: 50 + 1 และ 40 + 1",21,True,NAVY);y-=34
    headers=["ห้อง","อาจารย์ขอ","พิมพ์หลัก","สำรอง","รวมในซอง"]
    widths=[111,99,99,99,103]
    left=42
    for label,cw in zip(headers,widths):
        c.setFillColor(PALE);c.rect(left,y-27,cw,27,fill=1,stroke=0);txt(c,left+8,y-19,label,16,True);left+=cw
    y-=27
    for row in [["A101","50","50","1","51"],["B201","40","40","1","41"]]:
        left=42
        for value,cw in zip(row,widths):txt(c,left+8,y-22,value,17);left+=cw
        rule(c,42,y-31,w-84);y-=32
    y-=17;y=callout(c,"ยอดงานพิมพ์ = 92 ชุด","print_jobs.total_copies = 51 + 41 หนึ่งงานรวมสองห้อง ใบปะหน้าห้อง A แสดง 51 ห้อง B แสดง 41 ไม่ใช่พิมพ์ 92 ทุกห้อง",42,y,w-84)-22
    y=callout(c,"เปลี่ยนเฉพาะห้อง A: หลัก 52 + สำรอง 2 = 54","ยอดอาจารย์ใน student_count ยังเป็น 50 ห้อง B ยังเป็น 41 ดังนั้นยอดงานใหม่เป็น 95 ต้องมีเหตุผลการปรับ และเพิ่ม print_jobs.revision",42,y,w-84)-23
    txt(c,42,y-16,"อะไรต้องเปลี่ยน และอะไรต้องคงไว้",21,True,NAVY)
    y=para(c,"สร้างใบปะหน้ารุ่นปัจจุบันสำหรับทั้งสองห้องให้ตรง revision ใหม่ เก็บ COVER-A-V1/COVER-B-V1 ไว้ แล้วสร้างรุ่นใหม่ก่อนเริ่มพิมพ์ ไม่เขียนทับ FILE-V2 และไม่แก้ยอดที่อาจารย์เคยขอ หลังเริ่มพิมพ์แล้วแผนและไฟล์ถูกล็อก",42,y-31,w-84,size=17,leading=21)-24
    txt(c,42,y-16,"สิ่งที่ไม่ได้เก็บเป็นระบบในรุ่นนี้",21,True,NAVY)
    y=para(c,"ผู้เข้าสอบจริง ผู้ขาดสอบ และลายเซ็นผู้คุมสอบบนใบปะหน้าเป็นช่องว่างให้กรอกวันสอบ ไม่ได้มีตารางทะเบียนผู้สอบหรือระบบจัดที่นั่ง ไม่ติดตามการรับมอบ/แจกจ่ายหรือ QR และไม่ติดตามการเปิดอ่านอีเมล",42,y-31,w-84,size=17,leading=21)-24
    txt(c,42,y-16,"หลักฐานที่ใช้ตรวจเอกสาร",20,True,NAVY)
    y=para(c,"อ่าน PostgreSQL catalog เท่านั้น: information_schema, pg_constraint และ pg_indexes พบ 16 ตาราง / FK 24 จุด / migrations 6 รายการ\nเทียบ src/db/schema/auth.ts, domain.ts, docs/DATA_DICTIONARY.md และโค้ด workflow/actions\n__drizzle_migrations เป็น metadata; deliveries/distributions ถูกลบด้วย migration 0005 ประวัติเดิมถ้ามีอยู่ใน audit_logs",42,y-31,w-84,size=14,leading=18,color=MUTED)
    if y<61:raise ValueError(f"Final page overflow: {y}")
    c.showPage();c.save()
    main=diagram_page(vector,2,145,1458,"งานสอบ คำขอ ไฟล์ และงานพิมพ์","ใช้ชื่อจริง / สี่เหลี่ยมและข้าวหลามตัด / 1 และ N แสดงจำนวนสูงสุด")
    support=diagram_page(vector,3,1500,3160,"บัญชีและบทบาทของผู้ใช้ในข้อมูลธุรกิจ","users ที่แสดงซ้ำเป็นตารางเดียวกัน ส่วน C แยกเส้นผู้ใช้เพื่อไม่ให้ทับเส้นหลัก")
    reader=PdfReader(str(body));assert len(reader.pages)==17
    writer=PdfWriter()
    for i,page in enumerate(reader.pages):
        if i==1:page=PdfReader(str(main)).pages[0]
        elif i==2:page=PdfReader(str(support)).pages[0]
        writer.add_page(page)
    writer.add_metadata({"/Title":"คู่มือฐานข้อมูลระบบจัดพิมพ์ข้อสอบ / 4 ตุลาคม 2569","/Author":"ระบบจัดพิมพ์ข้อสอบ","/Subject":"16 tables, 24 foreign keys, read-only catalog inspection"})
    with open(PDF,"wb") as file:writer.write(file)
    return PDF

def create_attribute_report():
    """Only table purposes, every physical column, relationships, and M:N origins."""
    definitions = {}
    current = None
    for line in (ROOT / "docs/DATA_DICTIONARY.md").read_text(encoding="utf-8").splitlines():
        match = re.match(r"### \d+\. `([^`]+)`", line)
        if match:
            current = match.group(1)
            definitions[current] = {}
        elif line.startswith("## "):
            current = None
        elif current and line.startswith("| `"):
            cells = [item.strip().replace("`", "") for item in line.strip("|").split("|")]
            assert len(cells) == 5, line
            definitions[current][cells[0]] = cells[4]

    # Concise explanations of fields whose old dictionary wording was technical.
    descriptions = {
        ("users", "id"): "รหัสหลักของผู้ใช้ในระบบ",
        ("users", "username"): "ชื่อบัญชีที่ใช้เข้าสู่ระบบ",
        ("users", "display_username"): "ชื่อบัญชีสำหรับแสดงผล",
        ("users", "created_by"): "รหัสผู้ดูแลที่สร้างบัญชี (ไม่มี FK)",
        ("sessions", "id"): "รหัสหลักของการเข้าสู่ระบบแต่ละครั้ง",
        ("sessions", "token"): "โทเคนที่ใช้ตรวจ session ของผู้ใช้",
        ("sessions", "user_id"): "ผู้ใช้ที่เป็นเจ้าของ session",
        ("sessions", "impersonated_by"): "รหัสผู้ดูแลที่เข้าใช้งานแทน (ไม่มี FK)",
        ("accounts", "id"): "รหัสหลักของข้อมูลยืนยันตัวตน",
        ("accounts", "issuer"): "แหล่งยืนยันตัวตน; บัญชีรหัสผ่านใช้ local:credential",
        ("accounts", "account_id"): "รหัสบัญชีของวิธียืนยันตัวตนนั้น",
        ("accounts", "provider_id"): "วิธียืนยันตัวตน; รหัสผ่านใช้ credential",
        ("accounts", "user_id"): "ผู้ใช้เจ้าของข้อมูลยืนยันตัวตน",
        ("accounts", "access_token"): "โทเคนเข้าถึงผู้ให้บริการภายนอก ถ้ามี",
        ("accounts", "refresh_token"): "โทเคนต่ออายุการเข้าถึง ถ้ามี",
        ("accounts", "id_token"): "โทเคนข้อมูลตัวตนจากผู้ให้บริการ ถ้ามี",
        ("accounts", "scope"): "ขอบเขตสิทธิ์ที่ได้รับจากผู้ให้บริการ",
        ("accounts", "password"): "ค่ารหัสผ่านที่ผ่านการ hash ไม่ใช่รหัสผ่านที่อ่านได้",
        ("verifications", "id"): "รหัสหลักของรายการยืนยัน",
        ("exam_rounds", "name"): "ชื่อรอบสอบ: กลางภาค ปลายภาค หรือชื่ออื่น",
        ("rooms", "id"): "รหัสหลักภายในฐานข้อมูลของห้อง",
        ("rooms", "code"): "รหัสห้องที่ใช้แสดงและอ้างอิงในเอกสาร",
        ("rooms", "capacity"): "ความจุห้อง (จำนวนคนที่รองรับได้)",
        ("exam_requests", "original_copy_count"): "จำนวนต้นฉบับแบบเดิม คงไว้เพื่ออ่านข้อมูลเก่า",
        ("exam_requests", "submission_form"): "แบบฟอร์มออนไลน์: สาขา ภาษา รูปแบบพิมพ์ อุปกรณ์ กระดาษคำตอบ คำแนะนำ ประเภทสอบ และเบอร์ติดต่อ",
        ("exam_requests", "status"): "สถานะปัจจุบันของคำขอ",
        ("exam_requests", "cancelled_at"): "เวลายกเลิกคำขอแบบเก็บประวัติไว้",
        ("request_rooms", "id"): "รหัสหลักของรายละเอียดคำขอต่อห้อง",
        ("request_rooms", "student_count"): "จำนวนชุดที่อาจารย์ขอ ถือเป็นจำนวนผู้สอบ 1 ชุดต่อคน",
        ("request_rooms", "base_copy_count"): "ยอดพิมพ์หลักที่หน่วยโสตกำหนด เริ่มจากยอดอาจารย์",
        ("request_rooms", "reserve_count"): "จำนวนชุดสำรอง เริ่มที่ 1 และเปลี่ยนเป็น 0 ขึ้นไปได้",
        ("request_rooms", "print_count"): "ยอดพิมพ์รวม = base_copy_count + reserve_count",
        ("request_rooms", "qr_token"): "รหัสเดิมที่คงไว้ ปัจจุบันไม่ใช้สแกน QR",
        ("exam_files", "storage_key"): "ตำแหน่งไฟล์ในพื้นที่จัดเก็บส่วนตัวของ MinIO",
        ("exam_files", "size_bytes"): "ขนาดไฟล์เป็นไบต์ สูงสุด 104,857,600 ไบต์",
        ("exam_files", "sha256"): "ค่า SHA-256 สำหรับตรวจความครบถ้วนของไฟล์",
        ("cover_sheets", "print_revision"): "รุ่นแผนพิมพ์ที่ใช้สร้างใบปะหน้า; ข้อมูลเดิมอาจว่าง",
        ("print_jobs", "request_id"): "คำขอเจ้าของงานพิมพ์; ห้ามซ้ำ (UNIQUE)",
        ("print_jobs", "selected_exam_file_id"): "ไฟล์ที่เลือกพิมพ์ ต้องเป็นของคำขอเดียวกัน; ข้อมูลเดิมอาจว่าง",
        ("print_jobs", "confirmed_at"): "เวลาที่หน่วยโสตยืนยันไฟล์และจำนวนพิมพ์",
        ("notifications", "subject"): "หัวเรื่องอีเมล",
        ("notifications", "email_to"): "อีเมลปลายทางที่บันทึกไว้ขณะสร้างรายการ",
        ("audit_logs", "target_id"): "รหัสรายการเป้าหมายตาม target_type (ไม่มี FK)",
        ("audit_logs", "metadata"): "รายละเอียดเหตุการณ์แบบ JSON ไม่เก็บรหัสผ่านหรือไฟล์",
    }
    purpose_overrides = {
        "users": "เก็บบัญชี ชื่อ อีเมล บทบาท และสถานะเปิด-ปิดผู้ใช้ ส่วนรหัสผ่านแบบ hash แยกเก็บใน accounts",
        "sessions": "เก็บการเข้าสู่ระบบที่ยังมีอายุ พร้อมโทเคน วันหมดอายุ และข้อมูลอุปกรณ์ เพื่อให้ผู้ใช้ใช้งานต่อได้โดยไม่ต้องเข้าสู่ระบบทุกครั้ง",
        "accounts": "เก็บข้อมูลยืนยันตัวตนของ Better Auth รวมรหัสผ่านแบบ hash และช่องข้อมูลของผู้ให้บริการภายนอกที่ไลบรารีรองรับ",
        "verifications": "เก็บข้อมูลยืนยันชั่วคราวและวันหมดอายุ เช่น โทเคนสำหรับรีเซ็ตรหัสผ่าน",
        "exam_rounds": "เก็บชื่อรอบสอบ ปีการศึกษา ภาคเรียน ช่วงเปิดรับข้อสอบ และเจ้าหน้าที่ผู้สร้างรอบ",
        "subjects": "เก็บรายวิชา กลุ่มเรียน และอาจารย์ผู้รับผิดชอบของแต่ละรอบสอบ",
        "rooms": "เก็บรหัสห้อง ชื่อห้อง อาคาร ความจุ และสถานะเปิดใช้งานของห้องจริง",
        "exam_rooms": "เก็บการจับคู่รายวิชากับห้องสอบ พร้อมวันที่ เวลาเริ่ม และเวลาสิ้นสุดของการใช้ห้อง",
        "exam_requests": "เก็บคำขอจัดพิมพ์ของอาจารย์ แบบฟอร์มออนไลน์ จำนวนหน้าข้อสอบ สถานะ และข้อมูลการส่งกลับหรือยกเลิกคำขอ",
        "request_rooms": "เก็บรายละเอียดห้องและตาราง ณ ตอนสร้างคำขอ พร้อมจำนวนที่อาจารย์ขอ ยอดพิมพ์หลัก สำรอง และยอดรวมแยกต่อห้อง",
        "exam_files": "เก็บข้อมูลกำกับไฟล์ข้อสอบ ผู้ส่ง ชนิด รุ่น ขนาด และตำแหน่งจัดเก็บ ส่วนไฟล์ PDF จริงอยู่ใน MinIO",
        "cover_sheets": "เก็บข้อมูลไฟล์ใบปะหน้าซองแต่ละห้อง เวอร์ชัน ผู้สร้าง และรุ่นแผนพิมพ์ที่ใช้สร้าง PDF",
        "print_jobs": "เก็บงานพิมพ์หลักของคำขอ ไฟล์ที่เลือก ยอดพิมพ์รวมทุกห้อง ผู้รับผิดชอบ รุ่นแผน และเวลาเริ่ม-เสร็จ",
        "notifications": "เก็บคิวอีเมล เนื้อหา ผู้รับ ผลส่ง Pending/Sent/Failed จำนวนครั้งที่ส่ง และข้อผิดพลาด ไม่เก็บสถานะเปิดอ่าน",
        "request_status_history": "เก็บประวัติสถานะก่อน-หลังของคำขอ พร้อมผู้ดำเนินการ เหตุผล และเวลาที่เปลี่ยนสถานะ",
        "audit_logs": "เก็บเหตุการณ์สำคัญทั้งระบบ ผู้ดำเนินการ เป้าหมาย และรายละเอียด เพื่อย้อนตรวจการใช้งาน",
    }
    relation_notes = {
        ("subjects", "round_id"): "รอบสอบหนึ่งมีหลายรายวิชา เพื่อแยกข้อมูลการสอบแต่ละครั้ง",
        ("exam_requests", "subject_id"): "วิชาหนึ่งมีประวัติหลายคำขอได้ แต่มีคำขอที่ยังไม่ยกเลิกได้เพียงหนึ่งรายการ",
        ("cover_sheets", "request_room_id"): "ห้องในคำขอหนึ่งมีใบปะหน้าได้หลายรุ่น เมื่อไฟล์หรือจำนวนพิมพ์เปลี่ยน",
        ("print_jobs", "request_id"): "คำขอหนึ่งมีงานพิมพ์หลักได้ไม่เกินหนึ่งงาน เพราะ request_id ห้ามซ้ำ ก่อนรับงานอาจยังไม่มีงานพิมพ์",
        ("print_jobs", "selected_exam_file_id"): "ฐานข้อมูลไม่ห้ามเลือกไฟล์ซ้ำ จึงเป็น 1:N; แอปกำหนดให้เป็นไฟล์ของคำขอนั้น และมีงานเดียวต่อคำขอ ช่องนี้เว้นว่างได้",
        ("request_rooms", "exam_room_id"): "ตารางสอบเดียวถูกอ้างได้หลายคำขอตามประวัติ โดยเก็บรายละเอียดห้อง ณ เวลาสร้างคำขอ",
        ("accounts", "user_id"): "ผู้ใช้หนึ่งคนมีข้อมูลยืนยันตัวตนได้หลายรายการตามโครงสร้าง Better Auth แม้ระบบนี้ใช้ username/password เป็นหลัก",
    }
    junctions = {
        "exam_rooms": (
            "เกิดจาก subjects M:N rooms",
            "หนึ่งรายวิชาใช้ได้หลายห้อง และห้องเดียวใช้ได้หลายรายวิชาต่างเวลา จึงแยกคู่รายวิชา-ห้องพร้อมวันเวลาไว้ที่ exam_rooms",
            "subjects 1:N exam_rooms และ rooms 1:N exam_rooms",
        ),
        "request_rooms": (
            "เชื่อม exam_requests M:N exam_rooms ในประวัติคำขอ",
            "คำขอหนึ่งมีตารางสอบได้หลายห้อง ส่วนตารางสอบเดิมอาจถูกอ้างโดยคำขอที่ยกเลิกและคำขอใหม่ จึงเก็บคู่คำขอ-ตารางสอบ พร้อมรายละเอียดห้องและยอดพิมพ์ไว้ที่ request_rooms ไม่ใช่การให้วิชาหนึ่งมีหลายคำขอที่ยังใช้งานพร้อมกัน",
            "exam_requests 1:N request_rooms และ exam_rooms 1:N request_rooms",
        ),
    }
    notes = {
        "users": "created_by เก็บรหัสผู้สร้าง แต่ไม่มี FK กลับไป users จึงไม่มีความสัมพันธ์วนกลับที่ฐานข้อมูลบังคับ",
        "sessions": "impersonated_by เก็บรหัสผู้ดูแลที่ใช้งานแทน แต่ไม่มี FK แยกไป users",
        "print_jobs": "ไม่ใช่ตารางกลาง M:N ระหว่างคำขอกับไฟล์ แต่เป็นงานพิมพ์หนึ่งงานของคำขอที่เลือกไฟล์มาใช้",
        "notifications": "ไม่ใช่ตารางกลาง M:N ระหว่างผู้ใช้กับคำขอ แต่เป็นเหตุการณ์ส่งอีเมล แต่ละช่อง FK เว้นว่างได้เมื่อไม่มีผู้ใช้หรือคำขอที่อ้างอิง",
        "audit_logs": "target_id ไม่ใช่ FK ไป exam_requests เพราะใช้เก็บรหัสเป้าหมายได้หลายชนิดตาม target_type ส่วน actor_id เว้นว่างได้เมื่อไม่มีบัญชีต้นทาง",
    }
    width = A4[0] - 84
    body_style = ParagraphStyle("content", fontName="Sarabun", fontSize=16, leading=19.5, textColor=INK, wordWrap="CJK", shaping=1, spaceAfter=8)
    heading_style = ParagraphStyle("section", parent=body_style, fontName="SarabunB", fontSize=19, leading=23, textColor=NAVY, keepWithNext=True, spaceBefore=12, spaceAfter=7)
    cell_style = ParagraphStyle("cell", parent=body_style, fontSize=15.5, leading=18, spaceAfter=0)
    small_style = ParagraphStyle("small", parent=cell_style, fontSize=14, leading=16.5)
    title_style = ParagraphStyle("title", parent=heading_style, fontSize=27, leading=31, spaceBefore=0, spaceAfter=2)

    def p(text, style=body_style, bold=False):
        text = escape(normalize(text)).replace("\n", "<br/>")
        return Paragraph(f"<b>{text}</b>" if bold else text, style)

    def grid(headers, rows, widths):
        data = [[p(item, cell_style, True) for item in headers]] + rows
        result = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
        result.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), "Sarabun"),
            ("BACKGROUND", (0,0), (-1,0), PALE),
            ("LINEBELOW", (0,0), (-1,0), 0.85, NAVY),
            ("LINEBELOW", (0,1), (-1,-1), 0.35, RULE),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 7),
            ("RIGHTPADDING", (0,0), (-1,-1), 7),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        return result

    manifest = {"tables": {}, "foreignKeys": [], "junctions": list(junctions)}
    story = []
    for number, table in enumerate(TABLES, 1):
        name = table["name"]
        if number > 1:
            story.append(PageBreak())
        story.append(p(f"{number:02d}  {name}", title_style))
        story.append(p(f"{table['thai']}  |  {table['schema']}.{name}", body_style))
        story.append(p("เก็บอะไร: " + purpose_overrides[name]))
        story.append(p("Attribute", heading_style))
        columns = [r for r in CATALOG["columns"] if r["table_schema"] == table["schema"] and r["table_name"] == name]
        assert {r["column_name"] for r in columns} == set(definitions[name]), name
        manifest["tables"][name] = [r["column_name"] for r in columns]
        rows = []
        for column in columns:
            field = column["column_name"]
            datatype = {"timestamptz":"TIMESTAMPTZ", "int4":"INTEGER", "int8":"BIGINT", "bool":"BOOLEAN"}.get(column["udt_name"], column["udt_name"].upper())
            if column["data_type"] == "USER-DEFINED":
                datatype = column["udt_name"]
            if name == "audit_logs" and field == "id":
                datatype = "BIGSERIAL"
            key = " [PK]" if field == "id" else " [FK]" if (name, field) in FK else ""
            description = descriptions.get((name, field), definitions[name][field])
            description = description.replace("Snapshot", "ข้อมูลที่บันทึกไว้:").replace("snapshot", "ที่บันทึกไว้")
            rows.append([p(field + key, small_style, True), p(datatype, small_style), p(description, cell_style)])
        story.append(grid(["Attribute / Key", "ชนิดข้อมูล", "เก็บข้อมูลอะไร"], rows, [168, 94, width-262]))
        if name in {"users", "exam_requests", "request_rooms"}:
            story.append(PageBreak())
            story.append(p(f"{number:02d}  {name} (ต่อ)", title_style))
        story.append(p("ความสัมพันธ์และเหตุผล", heading_style))
        relevant = [r for r in RELS if r[0] == name or FK[(r[0],r[1])]["parent"] == name]
        if not relevant:
            story.append(p("ไม่มี Foreign Key เชื่อมกับตารางอื่น ข้อมูลถูกค้นด้วย identifier และ value ตามกระบวนการยืนยันของ Better Auth จึงไม่ใช่ตารางกลาง M:N"))
        else:
            rows = []
            for child, field, _, why in relevant:
                fk = FK[(child, field)]
                cardinal = "1:1" if (child, field) == ("print_jobs", "request_id") else "1:N"
                explanation = relation_notes.get((child, field), why)
                if not fk["required"] and (child, field) not in relation_notes:
                    explanation += " (FK เว้นว่างได้)"
                left = f"{fk['parent']} {cardinal} {child}\nFK: {child}.{field}"
                rows.append([p(left, small_style), p(explanation, cell_style)])
                if child == name:
                    manifest["foreignKeys"].append(f"{child}.{field}")
            story.append(grid(["ตารางและชนิดความสัมพันธ์", "เหตุผลที่เชื่อมกัน"], rows, [244, width-244]))
        if name in notes:
            story.extend([Spacer(1,7), p(notes[name])])
        if name in junctions:
            origin, reason, resolved = junctions[name]
            story.append(KeepTogether([p("ที่มาของตารางกลาง Many-to-Many (M:N)", heading_style), p(origin, body_style, True), p(reason), p(resolved, small_style)]))

    def decoration(c, doc):
        txt(c,42,A4[1]-27,"ระบบจัดพิมพ์ข้อสอบ | ตาราง ข้อมูล และความสัมพันธ์",12,color=MUTED)
        rule(c,42,37,width)
        c.setFillColor(MUTED); c.setFont("Sarabun",12)
        c.drawRightString(A4[0]-42,23,f"หน้า {doc.page}",shaping=True)

    def make_canvas(*args, **kwargs):
        kwargs["initialFontName"] = "Sarabun"
        return canvas.Canvas(*args, **kwargs)

    doc = SimpleDocTemplate(str(PDF), pagesize=A4, leftMargin=42, rightMargin=42, topMargin=46, bottomMargin=48, title="ตารางและความสัมพันธ์ของฐานข้อมูลระบบจัดพิมพ์ข้อสอบ", author="ระบบจัดพิมพ์ข้อสอบ")
    doc.build(story, onFirstPage=decoration, onLaterPages=decoration, canvasmaker=make_canvas)
    manifest["pages"] = len(PdfReader(str(PDF)).pages)
    (TMP / "content-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return PDF, manifest["pages"]

if __name__=="__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--erd", action="store_true", help="Also regenerate the existing ERD PNG")
    args = parser.parse_args()
    if args.erd:
        create_diagram()
        print(f"Created ERD: {PNG}")
    document, pages = create_attribute_report()
    print(f"Updated guide: {document} ({pages} pages)")
