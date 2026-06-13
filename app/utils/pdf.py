from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from app.store import Report, Competitor

def generate_report_pdf(report: Report, competitor: Competitor, output_path: str):
    doc = SimpleDocTemplate(output_path, pagesize=letter,
                            rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='TitleStyle', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=colors.darkblue))
    styles.add(ParagraphStyle(name='SubTitleStyle', parent=styles['Heading2'], fontSize=16, spaceAfter=10))
    styles.add(ParagraphStyle(name='NormalStyle', parent=styles['Normal'], fontSize=11, spaceAfter=10, leading=14))
    
    Story = []
    
    Story.append(Paragraph(f"Intelligence Report: {competitor.name}", styles["TitleStyle"])) 
    Story.append(Paragraph(f"Generated at: {report.generated_at.strftime('%Y-%m-%d %H:%M')}", styles["NormalStyle"])) 
    Story.append(Paragraph(f"Domain: {competitor.domain}", styles["NormalStyle"])) 
    Story.append(Spacer(1, 20))
    
    Story.append(Paragraph("Executive Summary", styles["SubTitleStyle"]))
    Story.append(Paragraph(report.summary or "No summary available.", styles["NormalStyle"])) 
    Story.append(Spacer(1, 20))
    
    insights = report.findings.get("insights", []) if isinstance(report.findings, dict) else []
    if insights:
        Story.append(Paragraph("Key Insights", styles["SubTitleStyle"]))
        for ins in insights:
            Story.append(Paragraph(f"<b>{ins.get('category', '').title()}:</b> {ins.get('details', '')}", styles["NormalStyle"]))
        Story.append(Spacer(1, 20))
        
    recs = report.findings.get("recommendations", []) if isinstance(report.findings, dict) else []
    if recs:
        Story.append(Paragraph("Strategic Recommendations", styles["SubTitleStyle"]))
        for rec in recs:
            Story.append(Paragraph(f"<b>{rec.get('title', '')}</b>", styles["NormalStyle"]))
            Story.append(Paragraph(f"{rec.get('description', '')}", styles["NormalStyle"]))
        Story.append(Spacer(1, 20))
        
    if report.raw_sources: 
        Story.append(Paragraph("Sources Analyzed", styles["SubTitleStyle"]))
        source_items = [ListItem(Paragraph(f"<a href='{url}'>{url}</a>", styles["NormalStyle"])) for url in report.raw_sources] 
        Story.append(ListFlowable(source_items, bulletType='bullet')) # type: ignore
        
    doc.build(Story)
    return output_path
