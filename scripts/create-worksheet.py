import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

root = Path(__file__).resolve().parents[1]
pages = json.loads((root / 'tmp' / 'worksheet.json').read_text(encoding='utf-8'))
pdfmetrics.registerFont(TTFont('Korean', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold', 'C:/Windows/Fonts/malgunbd.ttf'))
title = ParagraphStyle('Title', fontName='KoreanBold', fontSize=24, leading=35, textColor=HexColor('#172f47'), spaceAfter=24)
body = ParagraphStyle('Body', fontName='Korean', fontSize=15, leading=28, textColor=HexColor('#233e55'), spaceAfter=18)
small = ParagraphStyle('Small', parent=body, fontSize=10, leading=18, textColor=HexColor('#52697f'))
headings = ['탈출 속도의 의미와 가정', '에너지 보존과 공식 유도', '지구에 대입하기']
story = []
for index, page in enumerate(pages):
    if index: story.append(PageBreak())
    story.append(Paragraph(f'클래스보드 학습지 {index+1}/3', small))
    story.append(Paragraph(headings[index], title))
    # Plain-text equations deliberately preserve text extraction for the source workflow.
    for sentence in page['text'].split('. '):
        story.append(Paragraph(escape(sentence.replace('≈', ' (약) ')), body))
    story.append(Spacer(1, 22))
    story.append(Paragraph('직접 제작한 시연 자료. 수식의 텍스트 표기는 자료 검색용이며, 학생 판서는 분수와 제곱근으로 표시합니다.', small))
    story.append(Paragraph('참고: OpenStax University Physics 1, 13.3 Gravitational Potential Energy and Total Energy; NASA Earth Fact Sheet.', small))

SimpleDocTemplate(str(root/'public'/'earth-worksheet.pdf'), pagesize=A4, rightMargin=50, leftMargin=50, topMargin=46, bottomMargin=46, title='Classboard Earth escape speed worksheet', author='Classboard').build(story)
print('Created public/earth-worksheet.pdf')
