import { jsPDF } from "jspdf";

export function exportCanvasToPNG(canvas, fileName = "sketchy-board.png") {
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

export function exportCanvasToPDF(canvas, fileName = "sketchy-board.pdf") {
    if (!canvas) return;

    const imgData = canvas.toDataURL("image/png", 1.0);

    const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(fileName);
}

function normalizeBox(el) {
    const x = el.w >= 0 ? el.x : el.x + el.w;
    const y = el.h >= 0 ? el.y : el.y + el.h;
    const w = Math.abs(el.w || 0);
    const h = Math.abs(el.h || 0);
    return { x, y, w, h };
}

export function exportCanvasToSVG(
    elements,
    canvasWidth = 1600,
    canvasHeight = 900,
    fileName = "sketchy-board.svg"
) {
    const svgParts = [];

    svgParts.push(`
<svg xmlns="http://www.w3.org/2000/svg"
     width="${canvasWidth}"
     height="${canvasHeight}"
     viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <rect width="100%" height="100%" fill="white" />
`);

    (elements || []).forEach((el) => {
        if (!el || !el.type) return;

        if (el.type === "rectangle") {
            const { x, y, w, h } = normalizeBox(el);
            svgParts.push(`
  <rect
    x="${x}"
    y="${y}"
    width="${w}"
    height="${h}"
    fill="transparent"
    stroke="${el.stroke || "#111827"}"
    stroke-width="2"
  />
`);
        }

        else if (el.type === "ellipse") {
            const { x, y, w, h } = normalizeBox(el);
            svgParts.push(`
  <ellipse
    cx="${x + w / 2}"
    cy="${y + h / 2}"
    rx="${w / 2}"
    ry="${h / 2}"
    fill="transparent"
    stroke="${el.stroke || "#111827"}"
    stroke-width="2"
  />
`);
        }

        else if (el.type === "diamond") {
            const { x, y, w, h } = normalizeBox(el);
            const top = `${x + w / 2},${y}`;
            const right = `${x + w},${y + h / 2}`;
            const bottom = `${x + w / 2},${y + h}`;
            const left = `${x},${y + h / 2}`;

            svgParts.push(`
  <polygon
    points="${top} ${right} ${bottom} ${left}"
    fill="transparent"
    stroke="${el.stroke || "#111827"}"
    stroke-width="2"
  />
`);
        }

        else if (el.type === "line") {
            svgParts.push(renderLine(el, false));
        }

        else if (el.type === "arrow") {
            svgParts.push(renderLine(el, true));
        }

        else if (el.type === "pencil") {
            if (Array.isArray(el.points) && el.points.length > 1) {
                const pathData = el.points
                    .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                    .join(" ");

                svgParts.push(`
  <path
    d="${pathData}"
    fill="none"
    stroke="${el.stroke || "#111827"}"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);
            }
        }

        else if (el.type === "text") {
            const fontSize = el.fontSize || 20;
            const lineHeight = el.lineHeight || 24;
            const lines = String(el.text || "").split("\n");

            lines.forEach((line, index) => {
                svgParts.push(`
  <text
    x="${el.x || 0}"
    y="${(el.y || 0) + index * lineHeight}"
    font-size="${fontSize}"
    font-family="Arial, sans-serif"
    dominant-baseline="text-before-edge"
    fill="${el.stroke || "#111827"}"
  >${escapeXml(line)}</text>
`);
            });
        }
    });

    svgParts.push(`</svg>`);

    const blob = new Blob([svgParts.join("")], {
        type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function renderLine(el, withArrowHead = false) {
    const stroke = el.stroke || "#111827";

    if (el.lineStyle === "curved" && Array.isArray(el.points) && el.points.length > 1) {
        const pathData = el.points
            .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");

        let svg = `
  <path
    d="${pathData}"
    fill="none"
    stroke="${stroke}"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`;

        if (withArrowHead) {
            const len = el.points.length;
            const prev = el.points[len - 2];
            const last = el.points[len - 1];

            if (prev && last) {
                svg += renderArrowHead(prev.x, prev.y, last.x, last.y, stroke);
            }
        }

        return svg;
    }

    let svg = `
  <line
    x1="${el.x1 || 0}"
    y1="${el.y1 || 0}"
    x2="${el.x2 || 0}"
    y2="${el.y2 || 0}"
    stroke="${stroke}"
    stroke-width="2"
    stroke-linecap="round"
  />
`;

    if (withArrowHead) {
        svg += renderArrowHead(el.x1 || 0, el.y1 || 0, el.x2 || 0, el.y2 || 0, stroke);
    }

    return svg;
}

function renderArrowHead(x1, y1, x2, y2, stroke) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 12;

    const x3 = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const y3 = y2 - headLength * Math.sin(angle - Math.PI / 6);

    const x4 = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const y4 = y2 - headLength * Math.sin(angle + Math.PI / 6);

    return `
  <polygon
    points="${x2},${y2} ${x3},${y3} ${x4},${y4}"
    fill="${stroke}"
    stroke="${stroke}"
    stroke-width="1"
  />
`;
}

function escapeXml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}