import { apiUrl } from "../config/api";
import { authHeaders } from "../utils/auth";

async function readError(response, fallback) {
    try {
        const text = await response.text();
        if (!text) return fallback;
        try {
            const parsed = JSON.parse(text);
            return parsed.message || parsed.error || fallback;
        } catch {
            return text;
        }
    } catch {
        return fallback;
    }
}

function fileNameFromDisposition(response, fallback) {
    const header = response.headers.get("content-disposition") || "";
    const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) return decodeURIComponent(utfMatch[1]);
    const normalMatch = header.match(/filename="?([^";]+)"?/i);
    return normalMatch?.[1] || fallback;
}

async function downloadExport(path, payload, fallbackName) {
    const response = await fetch(apiUrl(path), {
        method: "POST",
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readError(response, "Document export failed"));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileNameFromDisposition(response, fallbackName);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function exportMarkdownPdf({ title, markdown }) {
    return downloadExport(
        "/api/markdown-documents/export/pdf",
        { title, markdown },
        `${title || "markdown-document"}.pdf`
    );
}

export function exportMarkdownXlsx({ title, markdown }) {
    return downloadExport(
        "/api/markdown-documents/export/xlsx",
        { title, markdown },
        `${title || "markdown-document"}.xlsx`
    );
}

export async function importDocumentAsMarkdown(file) {
    const body = new FormData();
    body.append("file", file);

    const response = await fetch(apiUrl("/api/markdown-documents/import"), {
        method: "POST",
        headers: authHeaders(),
        body,
    });

    if (!response.ok) {
        throw new Error(await readError(response, "Document import failed"));
    }

    return response.json();
}
