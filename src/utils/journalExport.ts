/**
 * Journal Export Utilities
 * Exports journal entries to PDF and Word formats
 * Organized by Year > Month with professional formatting
 */

import { jsPDF } from "jspdf";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  ImageRun,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import i18n from "@/i18n/config";
import { getDateLocale } from "@/utils/dateLocale";
import { isNativePlatform, saveFileNative, type NativeExportResult } from "@/utils/nativeExport";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { PREDEFINED_ACTIVITIES, getActivityEmoji } from "@/utils/activities";

// Export result type for native platforms
export type { NativeExportResult };

const getLocale = () => getDateLocale(i18n.language);

const t = (key: string) => i18n.t(key);

// Check if current language needs CJK font
const needsCJKFont = () => {
  const lang = i18n.language.split("-")[0];
  return lang === "ja" || lang === "zh" || lang === "ko";
};

// Convert base64 data URL to raw base64
const extractBase64 = (dataUrl: string): string => {
  if (dataUrl.includes(",")) {
    return dataUrl.split(",")[1];
  }
  return dataUrl;
};

// Get image type from data URL
const getImageType = (dataUrl: string): "JPEG" | "PNG" | "WEBP" => {
  if (dataUrl.includes("image/png")) return "PNG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "JPEG";
};

// Convert base64 to ArrayBuffer for docx ImageRun
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(extractBase64(base64));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export interface JournalEntry {
  id: string;
  date: string | Date;
  title: string;
  body: string;
  mood?: string;
  tags?: string[];
  activities?: string[];
  images?: string[];
}

interface EntriesByYearMonth {
  [year: string]: {
    [month: string]: JournalEntry[];
  };
}

// Traditional diary color palette
const COLORS = {
  primary: { r: 88, g: 28, b: 42 }, // Deep burgundy
  secondary: { r: 35, g: 55, b: 77 }, // Navy blue
  accent: { r: 139, g: 90, b: 43 }, // Antique gold
  dark: { r: 33, g: 33, b: 33 }, // Near black
  medium: { r: 85, g: 85, b: 85 }, // Dark gray
  light: { r: 128, g: 128, b: 128 }, // Gray
  muted: { r: 200, g: 195, b: 185 }, // Warm beige
  background: { r: 253, g: 251, b: 246 }, // Ivory/cream
};

/**
 * Group entries by Year > Month
 */
export const groupEntriesByYearMonth = (entries: JournalEntry[]): EntriesByYearMonth => {
  const grouped: EntriesByYearMonth = {};
  const locale = getLocale();

  entries.forEach((entry) => {
    const date = new Date(entry.date);
    const year = format(date, "yyyy", { locale });
    const month = format(date, "MMMM", { locale }); // Full month name

    if (!grouped[year]) {
      grouped[year] = {};
    }
    if (!grouped[year][month]) {
      grouped[year][month] = [];
    }

    grouped[year][month].push(entry);
  });

  return grouped;
};

/**
 * Load and register CJK font for PDF export
 * Uses Google Noto Sans JP loaded dynamically
 */
const loadCJKFont = async (doc: jsPDF): Promise<void> => {
  try {
    // Load Noto Sans JP from Google Fonts CDN (smaller subset)
    const fontUrl = "https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf";

    const response = await fetch(fontUrl);
    if (!response.ok) {
      console.warn("Failed to load CJK font, falling back to default");
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Font = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));

    // Add font to jsPDF
    doc.addFileToVFS("NotoSansJP-Regular.ttf", base64Font);
    doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");

    console.log("✅ CJK font loaded successfully");
  } catch (error) {
    console.warn("Failed to load CJK font:", error);
  }
};

/**
 * Draw elegant header on PDF page
 */
const drawPageHeader = (doc: jsPDF, journalName: string, pageWidth: number, useCJK: boolean) => {
  // Thin elegant line
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.line(20, 12, pageWidth - 20, 12);

  // Journal name centered in header
  doc.setFontSize(9);
  if (useCJK) {
    doc.setFont("NotoSansJP", "normal");
  } else {
    doc.setFont("times", "italic");
  }
  doc.setTextColor(COLORS.medium.r, COLORS.medium.g, COLORS.medium.b);
  doc.text(journalName, pageWidth / 2, 8, { align: "center" });
};

/**
 * Draw elegant page footer with centered page number
 */
const drawPageFooter = (doc: jsPDF, pageNum: number, totalPages: number, pageWidth: number, pageHeight: number) => {
  // Thin elegant footer line
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 30, pageHeight - 15, pageWidth / 2 + 30, pageHeight - 15);

  // Centered page number with classic styling
  doc.setFontSize(9);
  doc.setFont("times", "italic");
  doc.setTextColor(COLORS.medium.r, COLORS.medium.g, COLORS.medium.b);
  doc.text(`— ${pageNum} —`, pageWidth / 2, pageHeight - 8, { align: "center" });
};

/**
 * Draw elegant entry frame with thin left border
 */
const drawEntryFrame = (doc: jsPDF, x: number, y: number, width: number, height: number) => {
  // Thin elegant left border
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.8);
  doc.line(x - 3, y, x - 3, y + height);
};

/**
 * Draw ornamental separator line with flourish
 */
const drawSeparator = (doc: jsPDF, y: number, pageWidth: number, margin: number) => {
  const centerX = pageWidth / 2;
  const lineWidth = 40;

  // Left ornamental line
  doc.setDrawColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
  doc.setLineWidth(0.3);
  doc.line(centerX - lineWidth - 15, y, centerX - 8, y);

  // Center diamond ornament
  doc.setFillColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
  const diamondSize = 1.5;
  doc.moveTo(centerX, y - diamondSize);
  doc.lineTo(centerX + diamondSize, y);
  doc.lineTo(centerX, y + diamondSize);
  doc.lineTo(centerX - diamondSize, y);
  doc.lineTo(centerX, y - diamondSize);
  doc.fill();

  // Right ornamental line
  doc.line(centerX + 8, y, centerX + lineWidth + 15, y);
};

/**
 * Export journal entries to PDF
 * Supports Japanese/Chinese text with embedded CJK font
 * Professional design with headers, footers, and decorative elements
 */
export const exportToPDF = async (entries: JournalEntry[], journalName?: string): Promise<NativeExportResult> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  const locale = getLocale();
  let yPosition = margin;

  const defaultJournalName = journalName || t("export.myJournal");

  // Load CJK font if needed
  const useCJK = needsCJKFont();
  if (useCJK) {
    await loadCJKFont(doc);
  }

  const setFont = (style: "normal" | "bold" = "normal") => {
    if (useCJK) {
      doc.setFont("NotoSansJP", "normal"); // CJK font doesn't have bold variant
    } else {
      doc.setFont("helvetica", style);
    }
  };

  // ============ ELEGANT COVER PAGE ============

  // Subtle ivory background
  doc.setFillColor(COLORS.background.r, COLORS.background.g, COLORS.background.b);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Classic border frame
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(1.5);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30, "S");

  // Inner decorative border
  doc.setDrawColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
  doc.setLineWidth(0.3);
  doc.rect(20, 20, pageWidth - 40, pageHeight - 40, "S");

  // Top ornamental divider
  yPosition = 70;
  const ornamentWidth = 80;
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - ornamentWidth, yPosition, pageWidth / 2 - 10, yPosition);
  doc.line(pageWidth / 2 + 10, yPosition, pageWidth / 2 + ornamentWidth, yPosition);

  // Diamond ornament at center
  doc.setFillColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
  const dSize = 4;
  doc.moveTo(pageWidth / 2, yPosition - dSize);
  doc.lineTo(pageWidth / 2 + dSize, yPosition);
  doc.lineTo(pageWidth / 2, yPosition + dSize);
  doc.lineTo(pageWidth / 2 - dSize, yPosition);
  doc.lineTo(pageWidth / 2, yPosition - dSize);
  doc.fill();

  // Journal title - elegant serif style
  yPosition = 110;
  doc.setFontSize(28);
  if (useCJK) {
    doc.setFont("NotoSansJP", "normal");
  } else {
    doc.setFont("times", "bold");
  }
  doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.text(defaultJournalName, pageWidth / 2, yPosition, { align: "center" });

  // Subtle underline for title
  doc.setDrawColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
  doc.setLineWidth(0.5);
  const titleWidth = doc.getTextWidth(defaultJournalName);
  doc.line(pageWidth / 2 - titleWidth / 2, yPosition + 5, pageWidth / 2 + titleWidth / 2, yPosition + 5);

  // Entry count - elegant styling
  yPosition = 150;
  doc.setFontSize(14);
  if (useCJK) {
    doc.setFont("NotoSansJP", "normal");
  } else {
    doc.setFont("times", "italic");
  }
  doc.setTextColor(COLORS.medium.r, COLORS.medium.g, COLORS.medium.b);
  doc.text(`${entries.length} ${t("export.entries")}`, pageWidth / 2, yPosition, { align: "center" });

  // Bottom ornamental divider
  yPosition = 180;
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - ornamentWidth, yPosition, pageWidth / 2 - 10, yPosition);
  doc.line(pageWidth / 2 + 10, yPosition, pageWidth / 2 + ornamentWidth, yPosition);

  // Diamond ornament
  doc.setFillColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
  doc.moveTo(pageWidth / 2, yPosition - dSize);
  doc.lineTo(pageWidth / 2 + dSize, yPosition);
  doc.lineTo(pageWidth / 2, yPosition + dSize);
  doc.lineTo(pageWidth / 2 - dSize, yPosition);
  doc.lineTo(pageWidth / 2, yPosition - dSize);
  doc.fill();

  // Export date at bottom
  yPosition = pageHeight - 50;
  doc.setFontSize(10);
  if (useCJK) {
    doc.setFont("NotoSansJP", "normal");
  } else {
    doc.setFont("times", "italic");
  }
  doc.setTextColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
  doc.text(`${t("export.exportedOn")} ${format(new Date(), "MMMM d, yyyy", { locale })}`, pageWidth / 2, yPosition, {
    align: "center",
  });

  // Group entries
  const grouped = groupEntriesByYearMonth(entries);
  const years = Object.keys(grouped).sort(); // Oldest first (chronological)

  // ============ CONTENT PAGES ============

  for (const year of years) {
    const months = Object.keys(grouped[year]).sort((a, b) => {
      return new Date(`${a} 1, ${year}`).getMonth() - new Date(`${b} 1, ${year}`).getMonth();
    }); // January first (chronological)

    // New page for each year
    doc.addPage();
    yPosition = 25;

    // Draw page header
    drawPageHeader(doc, defaultJournalName, pageWidth, useCJK);

    // Year header - elegant serif style
    yPosition = 35;
    doc.setFontSize(22);
    if (useCJK) {
      doc.setFont("NotoSansJP", "normal");
    } else {
      doc.setFont("times", "bold");
    }
    doc.setTextColor(COLORS.secondary.r, COLORS.secondary.g, COLORS.secondary.b);
    doc.text(year, margin, yPosition + 5);

    // Underline ornament
    doc.setDrawColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition + 10, margin + 50, yPosition + 10);
    yPosition += 25;

    for (const month of months) {
      const monthEntries = grouped[year][month].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Oldest first within month

      // Check page space for month header
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 25;
        drawPageHeader(doc, defaultJournalName, pageWidth, useCJK);
        yPosition = 35;
      }

      // Month header - elegant italic style
      doc.setFontSize(14);
      if (useCJK) {
        doc.setFont("NotoSansJP", "normal");
      } else {
        doc.setFont("times", "bolditalic");
      }
      doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
      doc.text(month, margin, yPosition + 9);
      yPosition += 15;

      // Subtle dotted line under month
      doc.setDrawColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 2], 0);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      doc.setLineDashPattern([], 0);
      yPosition += 8;

      for (const entry of monthEntries) {
        // Estimate entry height
        const bodyLines = doc.splitTextToSize(entry.body.replace(/[#*_`]/g, "").trim(), contentWidth - 10);
        const estimatedHeight = 40 + bodyLines.length * 5 + (entry.images?.length ? 70 : 0);

        // Check if we need a new page
        if (yPosition + estimatedHeight > pageHeight - 30) {
          doc.addPage();
          yPosition = 25;
          drawPageHeader(doc, defaultJournalName, pageWidth, useCJK);
          yPosition = 35;
        }

        // Elegant left border line
        doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
        doc.setLineWidth(0.8);
        doc.line(margin - 3, yPosition - 2, margin - 3, yPosition + Math.min(estimatedHeight - 15, 80));

        // Entry date - elegant italic
        doc.setFontSize(9);
        if (useCJK) {
          doc.setFont("NotoSansJP", "normal");
        } else {
          doc.setFont("times", "italic");
        }
        doc.setTextColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
        doc.text(format(new Date(entry.date), "EEEE, MMMM d, yyyy", { locale }), margin + 2, yPosition + 3);
        yPosition += 8;

        // Entry title - serif bold
        doc.setFontSize(12);
        if (useCJK) {
          doc.setFont("NotoSansJP", "normal");
        } else {
          doc.setFont("times", "bold");
        }
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
        const titleLines = doc.splitTextToSize(entry.title, contentWidth - 5);
        doc.text(titleLines, margin + 2, yPosition + 2);
        yPosition += titleLines.length * 6 + 2;

        // Mood, activities, and tags - understated italic styling
        if (entry.mood || (entry.activities && entry.activities.length > 0) || (entry.tags && entry.tags.length > 0)) {
          yPosition += 2;
          doc.setFontSize(9);
          if (useCJK) {
            doc.setFont("NotoSansJP", "normal");
          } else {
            doc.setFont("times", "italic");
          }
          doc.setTextColor(COLORS.medium.r, COLORS.medium.g, COLORS.medium.b);

          let metaText = "";
          if (entry.mood) {
            const translatedMood = t(`journalEntry.moods.${entry.mood}`);
            metaText = `${t("export.mood")}: ${MOOD_EMOJI[entry.mood] || ''} ${translatedMood}`;
          }

          if (entry.activities && entry.activities.length > 0) {
            const activitiesText = entry.activities.map(a => {
              const emoji = getActivityEmoji(a);
              const label = PREDEFINED_ACTIVITIES.some(p => p.key === a) ? t(`activities.${a}`) : a;
              return emoji ? `${emoji} ${label}` : label;
            }).join(', ');
            metaText += metaText ? `  ·  ${activitiesText}` : activitiesText;
          }

          if (entry.tags && entry.tags.length > 0) {
            const tagsText = entry.tags.slice(0, 3).join(", ");
            metaText += metaText ? `  ·  ${tagsText}` : tagsText;
          }

          doc.text(metaText, margin + 2, yPosition + 2);
          yPosition += 8;
        }

        // Entry body - elegant serif typography
        yPosition += 3;
        doc.setFontSize(10);
        if (useCJK) {
          doc.setFont("NotoSansJP", "normal");
        } else {
          doc.setFont("times", "normal");
        }
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);

        // Add body with page breaks
        for (let i = 0; i < bodyLines.length; i++) {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 25;
            drawPageHeader(doc, defaultJournalName, pageWidth, useCJK);
            yPosition = 35;
          }
          doc.text(bodyLines[i], margin + 2, yPosition);
          yPosition += 5.5; // Slightly more line height for readability
        }

        // Add images if present
        if (entry.images && entry.images.length > 0) {
          yPosition += 8;

          for (const imageData of entry.images) {
            try {
              // Check if we need a new page for image
              if (yPosition > pageHeight - 80) {
                doc.addPage();
                yPosition = 25;
                drawPageHeader(doc, defaultJournalName, pageWidth, useCJK);
                yPosition = 35;
              }

              const imgType = getImageType(imageData);
              const maxWidth = contentWidth * 0.7;
              const maxHeight = 55;

              // Elegant thin image frame
              doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
              doc.setLineWidth(0.3);
              doc.rect(margin + 5, yPosition - 2, maxWidth + 4, maxHeight + 4, "S");

              // Add image with automatic scaling
              doc.addImage(imageData, imgType, margin + 7, yPosition, maxWidth, maxHeight, undefined, "MEDIUM");
              yPosition += maxHeight + 10;
            } catch (imgError) {
              console.warn("Failed to add image to PDF:", imgError);
            }
          }
        }

        yPosition += 12; // Space between entries

        // Draw separator between entries (not after last)
        if (monthEntries.indexOf(entry) < monthEntries.length - 1) {
          drawSeparator(doc, yPosition - 5, pageWidth, margin);
        }
      }

      yPosition += 8; // Extra space between months
    }
  }

  // Add page numbers to all pages
  const totalPages = doc.internal.pages.length - 1; // -1 because pages array is 1-indexed
  for (let i = 2; i <= totalPages; i++) {
    // Start from page 2 (skip cover)
    doc.setPage(i);
    drawPageFooter(doc, i - 1, totalPages - 1, pageWidth, pageHeight);
  }

  // Save the PDF
  const fileName = `${(journalName || "journal").replace(/[^a-z0-9]/gi, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  
  // On native platform (Android/iOS), save to Documents and return path
  if (isNativePlatform()) {
    const pdfBlob = doc.output('blob');
    return saveFileNative(pdfBlob, fileName, 'application/pdf');
  }
  
  // On web, use browser download
  doc.save(fileName);
  return { path: fileName, uri: '', fileName };
};

/**
 * Export journal entries to Word (DOCX)
 * Full Unicode support including CJK characters
 * Professional design with custom styles
 */
export const exportToWord = async (entries: JournalEntry[], journalName?: string): Promise<NativeExportResult> => {
  const grouped = groupEntriesByYearMonth(entries);
  const years = Object.keys(grouped).sort(); // Oldest first (chronological)
  const locale = getLocale();

  const docChildren: any[] = [];

  const defaultJournalName = journalName || t("export.myJournal");

  // ============ COVER PAGE ============

  // Decorative top border
  docChildren.push(
    new Paragraph({
      border: {
        top: { style: BorderStyle.SINGLE, size: 24, color: "6366F1" },
      },
      spacing: { after: 600 },
    }),
  );

  // Title
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: defaultJournalName,
          bold: true,
          size: 72,
          color: "1E293B",
          font: "Georgia",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // Decorative line
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "─────────  ✦  ─────────",
          size: 24,
          color: "6366F1",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  // Entry count
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${entries.length} `,
          bold: true,
          size: 48,
          color: "6366F1",
        }),
        new TextRun({
          text: t("export.entries"),
          size: 28,
          color: "64748B",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // Export date
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${t("export.exportedOn")} ${format(new Date(), "MMMM d, yyyy", { locale })}`,
          size: 22,
          color: "94A3B8",
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
  );

  // Bottom decorative border
  docChildren.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "EC4899" },
      },
      spacing: { after: 400 },
    }),
  );

  // ============ CONTENT ============

  for (const year of years) {
    const months = Object.keys(grouped[year]).sort((a, b) => {
      return new Date(`${a} 1, ${year}`).getMonth() - new Date(`${b} 1, ${year}`).getMonth();
    }); // January first (chronological)

    // Year header with styling
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `── ${year} ──`,
            bold: true,
            size: 40,
            color: "6366F1",
            font: "Georgia",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 300 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
        },
      }),
    );

    for (const month of months) {
      const monthEntries = grouped[year][month].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Oldest first within month

      // Month header with accent
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "▎",
              color: "8B5CF6",
              size: 32,
            }),
            new TextRun({
              text: ` ${month}`,
              bold: true,
              size: 32,
              color: "334155",
              font: "Georgia",
            }),
          ],
          spacing: { before: 400, after: 200 },
        }),
      );

      for (const entry of monthEntries) {
        // Entry date
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: format(new Date(entry.date), "EEEE, MMMM d, yyyy", { locale }),
                size: 20,
                color: "94A3B8",
                italics: true,
              }),
            ],
            spacing: { before: 300, after: 100 },
          }),
        );

        // Entry title with styling
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: entry.title,
                bold: true,
                size: 28,
                color: "1E293B",
              }),
            ],
            spacing: { after: 100 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: "EC4899", space: 10 },
            },
          }),
        );

        // Mood, activities, and tags with styled badges
        if (entry.mood || (entry.activities && entry.activities.length > 0) || (entry.tags && entry.tags.length > 0)) {
          const metaParts: TextRun[] = [];

          if (entry.mood) {
            const translatedMood = t(`journalEntry.moods.${entry.mood}`);
            metaParts.push(
              new TextRun({
                text: `✦ ${t("export.mood")}: ${MOOD_EMOJI[entry.mood] || ''} ${translatedMood}`,
                size: 20,
                color: "6366F1",
              }),
            );
          }

          if (entry.activities && entry.activities.length > 0) {
            if (metaParts.length > 0) {
              metaParts.push(new TextRun({ text: "   ", size: 20 }));
            }
            const activitiesText = entry.activities.map(a => {
              const emoji = getActivityEmoji(a);
              const label = PREDEFINED_ACTIVITIES.some(p => p.key === a) ? t(`activities.${a}`) : a;
              return emoji ? `${emoji} ${label}` : label;
            }).join(', ');
            metaParts.push(
              new TextRun({
                text: `${t("activities.label")}: ${activitiesText}`,
                size: 20,
                color: "10B981",
              }),
            );
          }

          if (entry.tags && entry.tags.length > 0) {
            if (metaParts.length > 0) {
              metaParts.push(new TextRun({ text: "   ", size: 20 }));
            }
            metaParts.push(
              new TextRun({
                text: `⚑ ${t("export.tags")}: ${entry.tags.join(", ")}`,
                size: 20,
                color: "8B5CF6",
                italics: true,
              }),
            );
          }

          docChildren.push(
            new Paragraph({
              children: metaParts,
              spacing: { after: 150 },
            }),
          );
        }

        // Entry body - preserve paragraphs with quote styling
        const bodyParagraphs = entry.body.split("\n\n");
        bodyParagraphs.forEach((para, idx) => {
          if (para.trim()) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: para.trim().replace(/[#*_`]/g, ""), // Clean markdown
                    size: 24,
                    color: "334155",
                  }),
                ],
                spacing: { after: 150 },
                indent: { left: 200 },
              }),
            );
          }
        });

        // Add images if present
        if (entry.images && entry.images.length > 0) {
          for (const imageData of entry.images) {
            try {
              const imageBuffer = base64ToArrayBuffer(imageData);

              docChildren.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageBuffer,
                      transformation: {
                        width: 400,
                        height: 300,
                      },
                      type: "jpg",
                    }),
                  ],
                  spacing: { before: 150, after: 150 },
                  alignment: AlignmentType.CENTER,
                }),
              );
            } catch (imgError) {
              console.warn("Failed to add image to Word document:", imgError);
            }
          }
        }

        // Decorative separator between entries
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "· · ·",
                size: 24,
                color: "CBD5E1",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: defaultJournalName,
                    size: 18,
                    color: "94A3B8",
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "— ",
                    color: "CBD5E1",
                    size: 20,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: "64748B",
                    size: 20,
                  }),
                  new TextRun({
                    text: " —",
                    color: "CBD5E1",
                    size: 20,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                },
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${(journalName || "journal").replace(/[^a-z0-9]/gi, "_")}_${format(new Date(), "yyyy-MM-dd")}.docx`;
  
  // On native platform (Android/iOS), save to Documents and return path
  if (isNativePlatform()) {
    return saveFileNative(blob, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  
  // On web, use browser download
  saveAs(blob, fileName);
  return { path: fileName, uri: '', fileName };
};
