import { uid } from "../utils/geometry";

const SCRIPT_CACHE = new Map();

function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (SCRIPT_CACHE.has(src)) return SCRIPT_CACHE.get(src);

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve(globalName ? window[globalName] : true);
        script.onerror = () => reject(new Error(`Could not load ${globalName || src}. Check your internet connection.`));
        document.head.appendChild(script);
    });
    SCRIPT_CACHE.set(src, promise);
    return promise;
}

function textElement({ x, y, text, w = 500, fontSize = 22, bold = false, stroke = "#172033", textAlign = "left" }) {
    const lines = String(text ?? "").split("\n").length;
    return {
        id: uid(), type: "text", x, y, text: String(text ?? ""), w,
        h: Math.max(fontSize * 1.35, lines * fontSize * 1.35),
        fontSize, lineHeight: 1.25, fontFamily: "Arial", bold,
        italic: false, underline: false, textAlign, stroke,
    };
}

function rectElement({ x, y, w, h, stroke = "#b9c2d0", fill = "#ffffff", cornerRadius = 4, strokeWidth = 1 }) {
    return {
        id: uid(), type: "rectangle", x, y, w, h, stroke, fill,
        strokeWidth, strokeDash: "solid", cornerRadius,
    };
}

function normalizeCell(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function makeTableFrame(sheetName, rows, canvasSize) {
    const width = Math.max(900, Number(canvasSize?.width) || 1200);
    const height = Math.max(600, Number(canvasSize?.height) || 700);
    const margin = 48;
    const titleHeight = 60;
    const maxRows = 18;
    const visibleRows = (rows || []).slice(0, maxRows);
    const columnCount = Math.max(1, Math.min(12, visibleRows.reduce((max, row) => Math.max(max, row.length), 0)));
    const tableWidth = width - margin * 2;
    const colWidth = tableWidth / columnCount;
    const rowHeight = Math.max(30, Math.min(48, (height - margin * 2 - titleHeight) / Math.max(1, visibleRows.length)));
    const elements = [
        textElement({ x: margin, y: margin - 4, text: sheetName, w: tableWidth, fontSize: 30, bold: true }),
    ];

    visibleRows.forEach((row, rowIndex) => {
        for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
            const x = margin + colIndex * colWidth;
            const y = margin + titleHeight + rowIndex * rowHeight;
            const isHeader = rowIndex === 0;
            elements.push(rectElement({
                x, y, w: colWidth, h: rowHeight,
                stroke: isHeader ? "#667085" : "#cbd5e1",
                fill: isHeader ? "#eef2f6" : "#ffffff",
                strokeWidth: isHeader ? 1.5 : 1,
                cornerRadius: 0,
            }));
            elements.push(textElement({
                x: x + 8, y: y + 7,
                text: normalizeCell(row?.[colIndex]),
                w: Math.max(20, colWidth - 16),
                fontSize: isHeader ? 15 : 14,
                bold: isHeader,
                stroke: "#263244",
            }));
        }
    });

    if ((rows || []).length > maxRows) {
        elements.push(textElement({
            x: margin,
            y: margin + titleHeight + visibleRows.length * rowHeight + 10,
            text: `Showing first ${maxRows} of ${rows.length} rows`,
            w: tableWidth,
            fontSize: 14,
            stroke: "#667085",
        }));
    }

    return {
        id: uid(),
        name: sheetName,
        elements,
        hiddenElementIds: [],
        durationMs: 2500,
    };
}

async function getXlsx() {
    return loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", "XLSX");
}

async function getJsZip() {
    return loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "JSZip");
}

export async function importSpreadsheetFile(file, canvasSize) {
    const XLSX = await getXlsx();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });

    return workbook.SheetNames.map((sheetName) => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
            raw: false,
            defval: "",
        });
        return makeTableFrame(sheetName, rows, canvasSize);
    });
}

function slideTextToFrame(slideName, textRuns, canvasSize) {
    const width = Math.max(900, Number(canvasSize?.width) || 1200);
    const height = Math.max(600, Number(canvasSize?.height) || 700);
    const margin = 64;
    const usableWidth = width - margin * 2;
    const cleanRuns = textRuns.map((item) => item.trim()).filter(Boolean);
    const title = cleanRuns[0] || slideName;
    const body = cleanRuns.slice(1);
    const elements = [
        textElement({ x: margin, y: 50, text: title, w: usableWidth, fontSize: 34, bold: true }),
    ];

    const columns = body.length > 7 ? 2 : 1;
    const columnGap = 42;
    const columnWidth = (usableWidth - (columns - 1) * columnGap) / columns;
    const itemsPerColumn = Math.ceil(body.length / columns);
    const availableHeight = height - 150;
    const itemHeight = Math.max(44, Math.min(76, availableHeight / Math.max(1, itemsPerColumn)));

    body.forEach((line, index) => {
        const column = Math.floor(index / itemsPerColumn);
        const row = index % itemsPerColumn;
        const x = margin + column * (columnWidth + columnGap);
        const y = 130 + row * itemHeight;
        elements.push(textElement({ x, y, text: `• ${line}`, w: columnWidth, fontSize: 20, stroke: "#344054" }));
    });

    return {
        id: uid(), name: slideName, elements, hiddenElementIds: [], durationMs: 3000,
    };
}

export async function importPowerPointFile(file, canvasSize) {
    const JSZip = await getJsZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slidePaths = Object.keys(zip.files)
        .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
        .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));

    if (!slidePaths.length) throw new Error("No slides were found in this PowerPoint file.");

    const parser = new DOMParser();
    const frames = [];
    for (let index = 0; index < slidePaths.length; index += 1) {
        const xmlText = await zip.file(slidePaths[index]).async("text");
        const xml = parser.parseFromString(xmlText, "application/xml");
        const textRuns = Array.from(xml.getElementsByTagNameNS("*", "t"))
            .map((node) => node.textContent || "");
        frames.push(slideTextToFrame(`Slide ${index + 1}`, textRuns, canvasSize));
    }
    return frames;
}

export function detectOfficeImportType(file) {
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".pptx")) return "ppt";
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) return "excel";
    if (name.endsWith(".docx")) return "word";
    if (name.endsWith(".json")) return "json";
    return "unknown";
}

function wordParagraphsToFrames(documentName, paragraphs, canvasSize) {
    const width = Math.max(900, Number(canvasSize?.width) || 1200);
    const height = Math.max(600, Number(canvasSize?.height) || 700);
    const margin = 64;
    const usableWidth = width - margin * 2;
    const titleHeight = 70;
    const lineHeight = 36;
    const maxLinesPerFrame = Math.max(8, Math.floor((height - margin * 2 - titleHeight) / lineHeight));
    const cleanParagraphs = (paragraphs || []).map((value) => String(value || "").trim()).filter(Boolean);

    if (!cleanParagraphs.length) {
        return [{
            id: uid(),
            name: documentName || "Word document",
            elements: [textElement({
                x: margin,
                y: margin,
                text: "This Word document did not contain readable text.",
                w: usableWidth,
                fontSize: 24,
                stroke: "#344054",
            })],
            hiddenElementIds: [],
            durationMs: 2500,
        }];
    }

    const pages = [];
    for (let start = 0; start < cleanParagraphs.length; start += maxLinesPerFrame) {
        pages.push(cleanParagraphs.slice(start, start + maxLinesPerFrame));
    }

    return pages.map((pageParagraphs, pageIndex) => {
        const elements = [
            textElement({
                x: margin,
                y: 42,
                text: pages.length > 1 ? `${documentName} — Page ${pageIndex + 1}` : documentName,
                w: usableWidth,
                fontSize: 30,
                bold: true,
            }),
        ];

        pageParagraphs.forEach((paragraph, index) => {
            elements.push(textElement({
                x: margin,
                y: 120 + index * lineHeight,
                text: paragraph,
                w: usableWidth,
                fontSize: 19,
                stroke: "#344054",
            }));
        });

        return {
            id: uid(),
            name: pages.length > 1 ? `Page ${pageIndex + 1}` : documentName,
            elements,
            hiddenElementIds: [],
            durationMs: 3000,
        };
    });
}

export async function importWordFile(file, canvasSize) {
    const name = String(file?.name || "Word document").replace(/\.docx$/i, "") || "Word document";
    if (!String(file?.name || "").toLowerCase().endsWith(".docx")) {
        throw new Error("Only .docx Word files are supported. Save older .doc files as .docx first.");
    }

    const JSZip = await getJsZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const documentEntry = zip.file("word/document.xml");
    if (!documentEntry) {
        throw new Error("This .docx file does not contain a readable Word document.");
    }

    const xmlText = await documentEntry.async("text");
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) {
        throw new Error("The Word document XML could not be parsed.");
    }

    const paragraphs = Array.from(xml.getElementsByTagNameNS("*", "p")).map((paragraph) => {
        return Array.from(paragraph.getElementsByTagNameNS("*", "t"))
            .map((node) => node.textContent || "")
            .join("");
    });

    return wordParagraphsToFrames(name, paragraphs, canvasSize);
}
