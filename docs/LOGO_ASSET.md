# โลโก้บนเว็บ

- ต้นฉบับ: `public/images.png` ตามที่ผู้ใช้ให้ ใช้ใน PDF ใบปะหน้าซองต่อไป ไม่เขียนทับ
- ฉบับเว็บ: `public/psu-logo-transparent.png` PNG RGBA, 1108 × 1420, พื้นหลังโปร่งใส ตรวจ alpha มุมภาพ = 0
- เครื่องมือ: built-in imagegen, background-extraction edit; อ้างอิงภาพต้นฉบับและเปิด transparent background
- ตรวจภาพบนหน้า login Docker ทั้ง light/dark แล้ว ไม่มีกรอบพื้นขาว ไม่เพิ่ม CSS พื้นขาวครอบโลโก้

Prompt ที่ใช้:

> Edit the supplied official Prince of Songkla University logo by background extraction ONLY. Remove the external solid white rectangular background surrounding the crest to true alpha transparency. Preserve the exact original gold and navy crest, its proportions, every line, all lettering, and internal white details that belong to the shield; do NOT redraw, reinterpret, modernize, replace, add, recolor, crop, or embellish the logo. Output a clean transparent PNG containing the original full crest with a small transparent margin. This is background removal, not logo generation.
