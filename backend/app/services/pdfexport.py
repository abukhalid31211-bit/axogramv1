"""PDF report generation (Arabic-friendly, using ReportLab with a built-in
Unicode font or a TTF fallback)."""
from __future__ import annotations

import io
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_FONT_NAME = "AxoArabic"
_FONT_REGISTERED = False


def _register_font() -> str:
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return _FONT_NAME
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(_FONT_NAME, path))
                _FONT_REGISTERED = True
                return _FONT_NAME
            except Exception:
                continue
    return "Helvetica"


def _styles():
    base = getSampleStyleSheet()
    font = _register_font()
    title = ParagraphStyle("AxoTitle", parent=base["Title"], fontName=font, fontSize=18, leading=24, alignment=1)
    heading = ParagraphStyle("AxoHeading", parent=base["Heading2"], fontName=font, fontSize=13, leading=18, spaceAfter=8)
    body = ParagraphStyle("AxoBody", parent=base["BodyText"], fontName=font, fontSize=10, leading=15, alignment=0)
    small = ParagraphStyle("AxoSmall", parent=base["BodyText"], fontName=font, fontSize=8, leading=11)
    return title, heading, body, small


def _rows_from_data(data: dict) -> list[list[str]]:
    labels = {
        "date": "التاريخ",
        "gathered_today": "المُجمَّع اليوم",
        "added_today": "المُضاف اليوم",
        "add_failed_today": "الفاشل اليوم",
        "dm_today": "رسائل DM اليوم",
        "group_today": "رسائل قروبات اليوم",
        "flood_today": "FloodWaits اليوم",
        "accounts_total": "إجمالي الحسابات",
        "accounts_active": "الحسابات النشطة",
        "proxies_total": "إجمالي البروكسيهات",
        "proxies_active": "البروكسيهات النشطة",
        "campaigns_active": "الحملات النشطة",
        "campaigns_sent_today": "رسائل الحملات اليوم",
        "total_operations_today": "إجمالي العمليات اليوم",
        "compare_yesterday_pct": "مقارنة بالأمس %",
        "best_account": "أفضل حساب",
        "bans_today": "حظر اليوم",
        "month": "الشهر",
        "total_gather": "إجمالي التجميع",
        "total_add": "إجمالي الإضافة",
        "total_dm": "إجمالي DM",
        "total_group": "إجمالي القروبات",
        "success_rate": "معدل النجاح %",
        "flood_waits": "FloodWaits",
        "accounts_lost": "حسابات مفقودة",
        "compare_prev_month_pct": "مقارنة بالشهر السابق %",
        "best_week": "أفضل أسبوع",
        "best_day": "أفضل يوم",
    }
    rows = []
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            continue
        label = labels.get(key, key)
        rows.append([label, str(value)])
    return rows


def build_report_pdf(title_text: str, data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm)
    title, heading, body, small = _styles()
    story = [Paragraph(title_text, title), Spacer(1, 6), Paragraph("Axogram Pro — تقرير", small), Spacer(1, 10)]
    table_data = [["البند", "القيمة"]] + _rows_from_data(data)
    table = Table(table_data, colWidths=[110 * mm, 60 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), _FONT_NAME),
                ("FONTNAME", (0, 1), (-1, -1), _FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), "#dbeafe"),
                ("GRID", (0, 0), (-1, -1), 0.4, "#cbd5e1"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [None, "#f8fafc"]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buffer.getvalue()


def build_campaign_report_pdf(campaign, data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm)
    title, heading, body, small = _styles()
    story = [
        Paragraph(f"تقرير الحملة: {campaign.name}", title),
        Spacer(1, 6),
        Paragraph(f"النوع: {'رسائل مباشرة' if campaign.kind == 'dm' else 'رسائل قروبات'} — الحالة: مكتملة", small),
        Spacer(1, 10),
        Paragraph("النتائج النهائية", heading),
    ]
    rows = [
        ["ناجح", str(data.get("success", 0))],
        ["تخطي", str(data.get("skipped", 0))],
        ["فاشل", str(data.get("failed", 0))],
        ["الإجمالي", str(data.get("total", 0))],
        ["مدة التشغيل (دقيقة)", str(data.get("duration_minutes", 0))],
    ]
    story.append(Table([["البند", "القيمة"]] + rows, colWidths=[110 * mm, 60 * mm], style=TableStyle([("FONTNAME", (0, 0), (-1, -1), _FONT_NAME), ("FONTSIZE", (0, 0), (-1, -1), 9), ("BACKGROUND", (0, 0), (-1, 0), "#dbeafe"), ("GRID", (0, 0), (-1, -1), 0.4, "#cbd5e1")])))
    reasons = data.get("failure_reasons") or {}
    if reasons:
        story.append(Spacer(1, 8))
        story.append(Paragraph("أسباب الفشل", heading))
        reason_rows = [["السبب", "العدد"]] + [[str(k), str(v)] for k, v in reasons.items()]
        story.append(Table(reason_rows, colWidths=[120 * mm, 50 * mm], style=TableStyle([("FONTNAME", (0, 0), (-1, -1), _FONT_NAME), ("FONTSIZE", (0, 0), (-1, -1), 9), ("GRID", (0, 0), (-1, -1), 0.4, "#cbd5e1")])))
    per_account = data.get("per_account") or {}
    if per_account:
        story.append(Spacer(1, 8))
        story.append(Paragraph("أداء الحسابات", heading))
        acc_rows = [["الحساب", "أُرسل", "فشل", "FloodWait"]] + [[k, str(v.get("sent", 0)), str(v.get("failed", 0)), str(v.get("flood", 0))] for k, v in per_account.items()]
        story.append(Table(acc_rows, colWidths=[70 * mm, 40 * mm, 40 * mm, 40 * mm], style=TableStyle([("FONTNAME", (0, 0), (-1, -1), _FONT_NAME), ("FONTSIZE", (0, 0), (-1, -1), 9), ("GRID", (0, 0), (-1, -1), 0.4, "#cbd5e1")])))
    doc.build(story)
    return buffer.getvalue()
