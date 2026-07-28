import React, { useMemo, useState } from "react";
import "./MarkdownViewer.css";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(source) {
  const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let code = [];
  let listType = null;
  const closeList = () => {
    if (listType) out.push(`</${listType}>`);
    listType = null;
  };
  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      closeList();
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
      }
      inCode = !inCode;
      return;
    }
    if (inCode) { code.push(line); return; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ul || ol) {
      const nextType = ol ? "ol" : "ul";
      if (listType !== nextType) { closeList(); listType = nextType; out.push(`<${nextType}>`); }
      out.push(`<li>${inlineMarkdown((ul || ol)[1])}</li>`);
      return;
    }
    closeList();
    if (/^>\s?/.test(line)) { out.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`); return; }
    if (/^---+$/.test(line.trim())) { out.push("<hr />"); return; }
    if (!line.trim()) { out.push("<br />"); return; }
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  });
  closeList();
  if (inCode && code.length) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return out.join("\n");
}

export default function MarkdownViewer({ open, fileName, content, onClose }) {
  const [mode, setMode] = useState("preview");
  const html = useMemo(() => renderMarkdown(content), [content]);
  if (!open) return null;
  return (
    <div className="md-viewer-backdrop" onMouseDown={onClose}>
      <section className="md-viewer" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <div><strong>{fileName || "Markdown"}</strong><span>Markdown viewer</span></div>
          <div className="md-viewer-actions">
            <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>Preview</button>
            <button className={mode === "raw" ? "active" : ""} onClick={() => setMode("raw")}>Raw</button>
            <button onClick={onClose}>✕</button>
          </div>
        </header>
        {mode === "raw" ? <pre className="md-raw">{content}</pre> : <article className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />}
      </section>
    </div>
  );
}
