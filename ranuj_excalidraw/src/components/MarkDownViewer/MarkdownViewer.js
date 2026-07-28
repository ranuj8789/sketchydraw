import React, { useMemo, useState } from "react";
import "./MarkdownViewer.css";

const STARTER_MARKDOWN = `# Markdown Grid

Paste or write Markdown on the left.

## Example

- Live preview
- Headings, lists and links
- **Bold**, *italic* and ~~strike~~

> Your preview updates automatically.

\`\`\`js
console.log("Hello SketchyDraw");
\`\`\`
`;

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

    if (inCode) {
      code.push(line);
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = ordered ? "ol" : "ul";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        out.push(`<${nextType}>`);
      }
      out.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      return;
    }

    closeList();
    if (/^>\s?/.test(line)) {
      out.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
      return;
    }
    if (/^---+$/.test(line.trim())) {
      out.push("<hr />");
      return;
    }
    if (!line.trim()) {
      out.push("<div class=\"md-spacer\"></div>");
      return;
    }
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  });

  closeList();
  if (inCode && code.length) {
    out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  }
  return out.join("\n");
}

export default function MarkdownViewer({
                                         open,
                                         title,
                                         content,
                                         onChange,
                                         onTitleChange,
                                         onClose,
                                       }) {
  const [view, setView] = useState("split");
  const markdown = content || "";
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);

  if (!open) return null;

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      window.prompt("Copy Markdown:", markdown);
    }
  };

  return (
      <section className="md-viewer md-workspace">
        <header className="md-viewer-header">
          <div className="md-viewer-heading">
            <input
                className="md-title-input"
                value={title || "Markdown Grid"}
                onChange={(event) => onTitleChange?.(event.target.value)}
                aria-label="Markdown grid title"
            />
            <span>Paste Markdown and see the rendered result instantly</span>
          </div>

          <div className="md-viewer-actions">
            <div className="md-view-switch" aria-label="Markdown grid view">
              <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>Editor</button>
              <button className={view === "split" ? "active" : ""} onClick={() => setView("split")}>Split</button>
              <button className={view === "preview" ? "active" : ""} onClick={() => setView("preview")}>Preview</button>
            </div>
            <button onClick={copyMarkdown}>Copy</button>
            <button onClick={() => window.print()}>Export PDF</button>
            <button onClick={() => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" })); link.download = `${title || "document"}.md`; link.click(); URL.revokeObjectURL(link.href); }}>Download .md</button>
            <button onClick={() => onChange?.(STARTER_MARKDOWN)}>Example</button>
            <button onClick={() => onChange?.("")}>Clear</button>
            <button className="md-close-button" onClick={onClose}>Back to canvas</button>
          </div>
        </header>

        <div className={`md-grid md-grid-${view}`}>
          {view !== "preview" && (
              <div className="md-pane md-editor-pane">
                <div className="md-pane-label">MARKDOWN</div>
                <textarea
                    autoFocus
                    className="md-editor"
                    value={markdown}
                    onChange={(event) => onChange?.(event.target.value)}
                    placeholder="# Paste your Markdown here..."
                    spellCheck="false"
                />
              </div>
          )}

          {view !== "editor" && (
              <div className="md-pane md-preview-pane">
                <div className="md-pane-label">PREVIEW</div>
                {markdown.trim() ? (
                    <article className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                    <div className="md-empty-state">
                      <strong>Your preview will appear here</strong>
                      <span>Paste Markdown in the editor panel.</span>
                    </div>
                )}
              </div>
          )}
        </div>
      </section>
  );
}
