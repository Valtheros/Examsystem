"""Read-only artifact validation and QA contact sheets; not a database test."""
from pathlib import Path
import json
import re
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw

root=Path(__file__).resolve().parents[1]
tmp=root/'tmp/pdfs/database-report'
pdf=root/'output/pdf/exam-database-2026-10-04-guide.pdf'
png=root/'output/pdf/exam-database-2026-10-04-erd.png'
catalog=json.loads((tmp/'catalog.json').read_text(encoding='utf-8'))
reader=PdfReader(str(pdf))
manifest=json.loads((tmp/'content-manifest.json').read_text(encoding='utf-8'))
assert len(reader.pages)==manifest['pages']
text='\n'.join(page.extract_text() or '' for page in reader.pages)
compact=re.sub(r'\s+', '', text)
for table in catalog['tables']:
    if table['table_schema']!='drizzle':
        assert table['table_name'] in text, table['table_name']
for key in catalog['foreignKeys']:
    assert f"{key['child']}.{key['column_name']}" in compact, key
assert set(manifest['foreignKeys'])=={f"{key['child']}.{key['column_name']}" for key in catalog['foreignKeys']}
for table, columns in manifest['tables'].items():
    assert set(columns)=={col['column_name'] for col in catalog['columns'] if col['table_name']==table}
    for column in columns:
        assert column in compact, (table,column)
sections={}
current=None
for page in reader.pages:
    content=page.extract_text() or ''
    for index,name in enumerate(manifest['tables'],1):
        if re.search(rf'(?m)^{index:02d}\s+{re.escape(name)}(?:\s|$)',content):
            current=name
            break
    assert current is not None
    assert len(content)>400, 'Orphan continuation page'
    sections[current]=sections.get(current,'')+re.sub(r'\s+','',content)
for table,columns in manifest['tables'].items():
    for column in columns:
        assert column in sections[table], (table,column,'missing from its table section')
assert 'print_jobs' in text and '1:1' in text
assert set(manifest['junctions'])=={'exam_rooms','request_rooms'}
assert 'subjectsM:Nrooms' in compact
assert 'exam_requestsM:Nexam_rooms' in compact
for removed in ['ตัวอย่างสมมติ','deliveries/distributions','หลักฐานที่ใช้ตรวจเอกสาร','DATABASE GUIDE']:
    assert removed not in text, removed
assert '\ufffd' not in text
fonts=set()
for page in reader.pages:
    for font in page['/Resources']['/Font'].get_object().values():
        obj=font.get_object()
        fonts.add(str(obj.get('/BaseFont')))
        desc=obj.get('/FontDescriptor')
        if desc:
            desc=desc.get_object()
            assert '/FontFile2' in desc or '/FontFile3' in desc
assert any('Sarabun' in name for name in fonts), fonts
assert all('Sarabun' in name for name in fonts), fonts
# Four pages per sheet; individual page PNGs remain available for close review.
for start in range(1,len(reader.pages)+1,4):
    sheet=Image.new('RGB',(1600,2260),'#dfe4e8')
    draw=ImageDraw.Draw(sheet)
    for j,number in enumerate(range(start,min(start+4,len(reader.pages)+1))):
        source=Image.open(tmp/f'revised-{number:02}.png').convert('RGB')
        image=ImageOps.contain(source,(780,1074))
        x=(j%2)*800+(800-image.width)//2
        y=(j//2)*1130+37
        sheet.paste(image,(x,y))
        draw.text(((j%2)*800+16,(j//2)*1130+12),f'PAGE {number:02}',fill='#152635')
    sheet.save(tmp/f'revised-contact-{start:02}.png')
summary={'pages':len(reader.pages),'tables':len(manifest['tables']),'attributes':sum(len(cols) for cols in manifest['tables'].values()),'foreignKeys':len(catalog['foreignKeys']),'junctionTables':manifest['junctions'],'fonts':sorted(fonts),'fullTextChars':len(text)}
(tmp/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
for number,page in enumerate(reader.pages,1):
    content=page.extract_text() or ''
    print(f'Page {number:02}: {len(content)} characters | ' + ' / '.join(content.splitlines()[2:5]))
