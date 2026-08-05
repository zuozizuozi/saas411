"""Render the acceptance-checkpoint PDF to PNG pages for visual QA."""

import os
from pathlib import Path

import pypdfium2 as pdfium


pdf_path = Path(os.environ["ACCEPTANCE_PDF"])
out_dir = Path(os.environ["ACCEPTANCE_RENDER_DIR"])
out_dir.mkdir(parents=True, exist_ok=True)

pdf = pdfium.PdfDocument(str(pdf_path))
for index in range(len(pdf)):
    image = pdf[index].render(scale=1.7).to_pil()
    image.save(out_dir / f"page-{index + 1}.png")

print(f"PAGES={len(pdf)}")
