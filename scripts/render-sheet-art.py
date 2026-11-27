"""Render page one without preprinted values covered by editable combat fields.

Requires PyMuPDF and Pillow. The original PDF remains unchanged.
Run from the repository root: python scripts/render-sheet-art.py
"""
from pathlib import Path

import fitz

root = Path(__file__).resolve().parents[1]
document = fitz.open(root / 'public/character-sheet-original.pdf')
page = document[0]
# Only remove the six defaults in the first combat row, preserving paper,
# table rules and headings. HTML fields supply the localized placeholders.
expected = ['Рукопашний', '1К3 + БП', '1', '-', '-', '-']
spans = [
    span
    for block in page.get_text('dict')['blocks']
    for line in block.get('lines', [])
    for span in line['spans']
    if 718 < span['bbox'][1] < 719 and span['bbox'][0] < 430
]
if [span['text'] for span in spans] != expected:
    raise RuntimeError('The source sheet changed; check combat-row coordinates.')
for span in spans:
    page.add_redact_annot(fitz.Rect(span['bbox']), fill=None, cross_out=False)
page.apply_redactions(images=0, graphics=0, text=0)
remaining = page.get_text()
assert 'Рукопашний' not in remaining and '1К3 + БП' not in remaining
assert 'Зброя' in remaining and 'Уміння' in remaining
scale = 1035 / page.rect.width
pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, annots=False)
assert (pixmap.width, pixmap.height) == (1035, 1352)
pixmap.pil_save(root / 'public/assets/investigator-sheet-1.webp', format='WEBP', quality=90)
print('Rendered page one: six duplicate defaults removed; original PDF preserved.')
