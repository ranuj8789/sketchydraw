package com.sketchydraw.markdown.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Service;
import org.jsoup.Jsoup;
import org.jsoup.helper.W3CDom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.*;

@Service
@SuppressWarnings({"HttpUrlsUsage", "SpellCheckingInspection"})
public class MarkdownDocumentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MarkdownDocumentService.class);

    private static final Parser MARKDOWN_PARSER = Parser.builder().build();
    private static final HtmlRenderer HTML_RENDERER = HtmlRenderer.builder()
            .escapeHtml(true)
            .build();

    public byte[] createPdf(String title, String markdown) throws IOException {
        String safeTitle = blankToDefault(title, "Markdown Document");
        String safeMarkdown = Optional.ofNullable(markdown).orElse("");

        org.commonmark.node.Node document = MARKDOWN_PARSER.parse(safeMarkdown);
        String bodyHtml = HTML_RENDERER.render(document);
        String html = buildPdfHtml(safeTitle, bodyHtml);

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            // OpenHTMLToPDF is strict about XHTML. Jsoup normalizes the generated
            // HTML first, and W3CDom gives the renderer a valid DOM directly.
            org.jsoup.nodes.Document jsoupDocument = Jsoup.parse(html);
            jsoupDocument.outputSettings()
                    .syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml)
                    .charset(StandardCharsets.UTF_8)
                    .prettyPrint(false);

            Document w3cDocument = new W3CDom().fromJsoup(jsoupDocument);

            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            registerUnicodeFont(builder);
            builder.withW3cDocument(w3cDocument, "");
            builder.toStream(output);
            builder.run();

            byte[] pdf = output.toByteArray();
            if (pdf.length == 0) {
                throw new IOException("PDF renderer returned an empty document");
            }
            return pdf;
        } catch (Exception exception) {
            LOGGER.error("Styled PDF generation failed for title: {}", safeTitle, exception);
            throw new IOException(
                    "Unable to create styled PDF: "
                            + exception.getClass().getSimpleName()
                            + ": "
                            + Optional.ofNullable(exception.getMessage()).orElse("no details"),
                    exception
            );
        }
    }

    private String buildPdfHtml(String title, String bodyHtml) {
        String template = """
                <!doctype html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <style>
                    @page {
                      size: A4;
                      margin: 18mm 17mm 20mm;
                      @bottom-left {
                        content: "SketchyDraw - Markdown Grid";
                        color: #64748b;
                        font-size: 8.5pt;
                      }
                      @bottom-right {
                        content: "Page " counter(page) " of " counter(pages);
                        color: #64748b;
                        font-size: 8.5pt;
                      }
                    }

                    * { box-sizing: border-box; }

                    html, body {
                      margin: 0;
                      padding: 0;
                      color: #172033;
                      font-family: "SketchyUnicode", "DejaVu Sans", Arial, sans-serif;
                      font-size: 10.6pt;
                      line-height: 1.55;
                    }

                    .document-header {
                      margin: 0 0 18px;
                      padding: 0 0 12px;
                      border-bottom: 2px solid #e7edf5;
                    }

                    .document-kicker {
                      color: #8b6b2a;
                      font-size: 8.5pt;
                      font-weight: 700;
                      letter-spacing: .08em;
                      text-transform: uppercase;
                    }

                    .document-title {
                      margin: 5px 0 0;
                      color: #0f172a;
                      font-size: 24pt;
                      line-height: 1.15;
                      font-weight: 800;
                      letter-spacing: -.025em;
                    }

                    h1, h2, h3, h4, h5, h6 {
                      color: #0f172a;
                      page-break-after: avoid;
                    }

                    h1 {
                      margin: 23px 0 10px;
                      padding-bottom: 7px;
                      border-bottom: 1px solid #dce4ef;
                      font-size: 20pt;
                      line-height: 1.2;
                    }

                    h2 { margin: 20px 0 8px; font-size: 16pt; line-height: 1.25; }
                    h3 { margin: 16px 0 7px; font-size: 13pt; }
                    h4, h5, h6 { margin: 13px 0 6px; font-size: 11pt; }
                    p { margin: 0 0 9px; }
                    strong { color: #0f172a; }
                    ul, ol { margin: 6px 0 12px 21px; padding: 0; }
                    li { margin: 3px 0; padding-left: 2px; }

                    blockquote {
                      margin: 13px 0;
                      padding: 9px 13px;
                      border-left: 4px solid #d5b665;
                      background: #fffaf0;
                      color: #475569;
                      page-break-inside: avoid;
                    }

                    code {
                      padding: 1px 4px;
                      border: 1px solid #dce4ee;
                      border-radius: 4px;
                      background: #f3f6fa;
                      color: #9f1239;
                      font-family: "DejaVu Sans Mono", monospace;
                      font-size: 9.2pt;
                    }

                    pre {
                      margin: 12px 0;
                      padding: 12px 14px;
                      border-radius: 8px;
                      background: #111827;
                      color: #e5edf7;
                      white-space: pre-wrap;
                      word-wrap: break-word;
                      font-family: "DejaVu Sans Mono", monospace;
                      font-size: 8.8pt;
                      line-height: 1.45;
                      page-break-inside: avoid;
                    }

                    pre code { padding: 0; border: 0; background: transparent; color: inherit; }

                    table {
                      width: 100%;
                      margin: 12px 0 16px;
                      border-collapse: collapse;
                      table-layout: fixed;
                    }

                    th, td {
                      padding: 7px 8px;
                      border: 1px solid #d9e2ee;
                      vertical-align: top;
                      word-wrap: break-word;
                    }

                    th { background: #eef4ff; color: #1e3a8a; font-weight: 700; }
                    tr:nth-child(even) td { background: #f8fafc; }
                    hr { height: 1px; margin: 18px 0; border: 0; background: #dce4ed; }
                    a { color: #1d4ed8; text-decoration: none; }
                    img { max-width: 100%; height: auto; }
                    .content > :first-child { margin-top: 0; }
                  </style>
                </head>
                <body>
                  <header class="document-header">
                    <div class="document-kicker">SketchyDraw Markdown Grid</div>
                    <div class="document-title">__DOCUMENT_TITLE__</div>
                  </header>
                  <main class="content">__DOCUMENT_BODY__</main>
                </body>
                </html>
                """;

        return template
                .replace("__DOCUMENT_TITLE__", htmlEscape(title))
                .replace("__DOCUMENT_BODY__", bodyHtml);
    }

    private void registerUnicodeFont(PdfRendererBuilder builder) {
        List<Path> candidates = List.of(
                Path.of("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
                Path.of("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
                Path.of("/Library/Fonts/Arial Unicode.ttf"),
                Path.of(System.getProperty("java.home"), "lib", "fonts", "DejaVuSans.ttf")
        );

        candidates.stream()
                .filter(Files::isRegularFile)
                .findFirst()
                .ifPresent(path -> builder.useFont(path.toFile(), "SketchyUnicode"));
    }

    public byte[] createXlsx(String title, String markdown) throws IOException {
        List<List<String>> rows = markdownToRows(markdown);
        if (rows.isEmpty()) rows.add(List.of(blankToDefault(title, "Markdown Document")));

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            put(zip, "[Content_Types].xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                      <Default Extension="xml" ContentType="application/xml"/>
                      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                    </Types>
                    """);
            put(zip, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                    </Relationships>
                    """);
            put(zip, "xl/workbook.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                      <sheets><sheet name="Markdown" sheetId="1" r:id="rId1"/></sheets>
                    </workbook>
                    """);
            put(zip, "xl/_rels/workbook.xml.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                    </Relationships>
                    """);
            put(zip, "xl/styles.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                      <fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts>
                      <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
                      <borders count="1"><border/></borders>
                      <cellStyleXfs count="1"><xf/></cellStyleXfs>
                      <cellXfs count="1"><xf xfId="0"/></cellXfs>
                    </styleSheet>
                    """);
            put(zip, "xl/worksheets/sheet1.xml", worksheetXml(rows));
        }
        return output.toByteArray();
    }

    public ImportedMarkdown importDocument(MultipartFile file) throws Exception {
        String original = Optional.ofNullable(file.getOriginalFilename()).orElse("document");
        String lower = original.toLowerCase(Locale.ROOT);
        byte[] bytes = file.getBytes();
        String markdown;
        String type;

        if (lower.endsWith(".xlsx")) {
            markdown = xlsxToMarkdown(bytes);
            type = "xlsx";
        } else if (lower.endsWith(".docx")) {
            markdown = docxToMarkdown(bytes);
            type = "docx";
        } else if (lower.endsWith(".csv")) {
            markdown = csvToMarkdown(new String(bytes, StandardCharsets.UTF_8));
            type = "csv";
        } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
            markdown = htmlToMarkdown(new String(bytes, StandardCharsets.UTF_8));
            type = "html";
        } else if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
            markdown = new String(bytes, StandardCharsets.UTF_8);
            type = lower.endsWith(".txt") ? "txt" : "markdown";
        } else if (lower.endsWith(".doc")) {
            throw new IllegalArgumentException("Legacy .doc is not supported. Save it as .docx and import again.");
        } else {
            throw new IllegalArgumentException("Supported imports: .md, .txt, .csv, .xlsx, .docx, .html");
        }

        return new ImportedMarkdown(stripExtension(original), markdown.strip(), type);
    }

    private String xlsxToMarkdown(byte[] bytes) throws Exception {
        Map<String, byte[]> entries = unzip(bytes);
        List<String> shared = readSharedStrings(entries.get("xl/sharedStrings.xml"));
        List<String> sheetPaths = entries.keySet().stream()
                .filter(k -> k.matches("xl/worksheets/sheet\\d+\\.xml"))
                .sorted().toList();
        StringBuilder md = new StringBuilder();
        int sheetNo = 1;
        for (String path : sheetPaths) {
            List<List<String>> rows = readWorksheet(entries.get(path), shared);
            if (rows.isEmpty()) continue;
            if (sheetPaths.size() > 1) md.append("## Sheet ").append(sheetNo++).append("\n\n");
            appendMarkdownTable(md, rows);
            md.append("\n");
        }
        return md.toString();
    }

    private String docxToMarkdown(byte[] bytes) throws Exception {
        Map<String, byte[]> entries = unzip(bytes);
        byte[] xml = entries.get("word/document.xml");
        if (xml == null) throw new IllegalArgumentException("Invalid DOCX: word/document.xml is missing");
        Document doc = parseXml(xml);
        StringBuilder out = new StringBuilder();
        NodeList bodyChildren = doc.getDocumentElement().getElementsByTagNameNS("*", "body");
        if (bodyChildren.getLength() == 0) return "";
        Node body = bodyChildren.item(0);
        for (Node node = body.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node.getNodeType() != Node.ELEMENT_NODE) continue;
            String local = node.getLocalName();
            if ("p".equals(local)) {
                String value = nodeText(node).trim();
                if (!value.isEmpty()) out.append(value).append("\n\n");
            } else if ("tbl".equals(local)) {
                List<List<String>> rows = new ArrayList<>();
                NodeList trList = ((Element) node).getElementsByTagNameNS("*", "tr");
                for (int i = 0; i < trList.getLength(); i++) {
                    NodeList cells = ((Element) trList.item(i)).getElementsByTagNameNS("*", "tc");
                    List<String> row = new ArrayList<>();
                    for (int j = 0; j < cells.getLength(); j++) row.add(nodeText(cells.item(j)).trim());
                    rows.add(row);
                }
                appendMarkdownTable(out, rows);
                out.append("\n");
            }
        }
        return out.toString();
    }

    private List<List<String>> markdownToRows(String markdown) {
        List<List<String>> rows = new ArrayList<>();
        String[] lines = Optional.ofNullable(markdown).orElse("").replace("\r\n", "\n").split("\n");
        for (String raw : lines) {
            String line = raw.trim();
            if (line.matches("^\\|?\\s*:?-{3,}.*")) continue;
            if (line.contains("|")) {
                String cleaned = line;
                if (cleaned.startsWith("|")) cleaned = cleaned.substring(1);
                if (cleaned.endsWith("|")) cleaned = cleaned.substring(0, cleaned.length() - 1);
                List<String> cells = Arrays.stream(cleaned.split("\\|", -1)).map(String::trim).toList();
                if (cells.size() > 1) { rows.add(cells); continue; }
            }
            if (!line.isEmpty()) rows.add(List.of(stripMarkdown(line)));
        }
        return rows;
    }

    private String worksheetXml(List<List<String>> rows) {
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        for (int r = 0; r < rows.size(); r++) {
            xml.append("<row r=\"").append(r + 1).append("\">");
            List<String> row = rows.get(r);
            for (int c = 0; c < row.size(); c++) {
                String ref = columnName(c + 1) + (r + 1);
                xml.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                        .append(xmlEscape(row.get(c))).append("</t></is></c>");
            }
            xml.append("</row>");
        }
        return xml.append("</sheetData></worksheet>").toString();
    }

    private List<String> readSharedStrings(byte[] xml) throws Exception {
        if (xml == null) return List.of();
        Document document = parseXml(xml);
        NodeList items = document.getElementsByTagNameNS("*", "si");
        List<String> values = new ArrayList<>();
        for (int i = 0; i < items.getLength(); i++) values.add(nodeText(items.item(i)));
        return values;
    }

    private List<List<String>> readWorksheet(byte[] xml, List<String> shared) throws Exception {
        List<List<String>> rows = new ArrayList<>();
        if (xml == null) return rows;
        Document document = parseXml(xml);
        NodeList rowNodes = document.getElementsByTagNameNS("*", "row");
        for (int r = 0; r < rowNodes.getLength(); r++) {
            NodeList cells = ((Element) rowNodes.item(r)).getElementsByTagNameNS("*", "c");
            TreeMap<Integer, String> indexed = new TreeMap<>();
            for (int c = 0; c < cells.getLength(); c++) {
                Element cell = (Element) cells.item(c);
                int col = columnIndex(cell.getAttribute("r"));
                String type = cell.getAttribute("t");
                String value = "";
                NodeList inline = cell.getElementsByTagNameNS("*", "is");
                if (inline.getLength() > 0) value = nodeText(inline.item(0));
                else {
                    NodeList values = cell.getElementsByTagNameNS("*", "v");
                    if (values.getLength() > 0) value = values.item(0).getTextContent();
                    if ("s".equals(type)) {
                        int idx = Integer.parseInt(value);
                        value = idx >= 0 && idx < shared.size() ? shared.get(idx) : value;
                    }
                }
                indexed.put(col, value);
            }
            if (!indexed.isEmpty()) {
                List<String> row = new ArrayList<>(Collections.nCopies(indexed.lastKey() + 1, ""));
                indexed.forEach(row::set);
                rows.add(row);
            }
        }
        return rows;
    }

    private String csvToMarkdown(String csv) {
        List<List<String>> rows = new ArrayList<>();
        for (String line : csv.replace("\r\n", "\n").split("\n")) {
            if (!line.isBlank()) rows.add(parseCsvLine(line));
        }
        StringBuilder out = new StringBuilder();
        appendMarkdownTable(out, rows);
        return out.toString();
    }

    private List<String> parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') { current.append('"'); i++; }
                else quoted = !quoted;
            } else if (ch == ',' && !quoted) { result.add(current.toString()); current.setLength(0); }
            else current.append(ch);
        }
        result.add(current.toString());
        return result;
    }

    private String htmlToMarkdown(String html) {
        return html.replaceAll("(?is)<script.*?</script>|<style.*?</style>", "")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</p>|</div>|</h[1-6]>|</li>", "\n")
                .replaceAll("(?i)<li[^>]*>", "- ")
                .replaceAll("(?is)<[^>]+>", "")
                .replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").strip();
    }

    private void appendMarkdownTable(StringBuilder out, List<List<String>> rows) {
        if (rows == null || rows.isEmpty()) return;
        int columns = rows.stream().mapToInt(List::size).max().orElse(1);
        appendRow(out, rows.get(0), columns);
        out.append("|");
        for (int i = 0; i < columns; i++) out.append(" --- |");
        out.append("\n");
        for (int i = 1; i < rows.size(); i++) appendRow(out, rows.get(i), columns);
    }

    private void appendRow(StringBuilder out, List<String> row, int columns) {
        out.append("|");
        for (int i = 0; i < columns; i++) {
            String value = i < row.size() ? row.get(i) : "";
            out.append(" ").append(value.replace("|", "\\|").replace("\n", " ")).append(" |");
        }
        out.append("\n");
    }

    private String stripMarkdown(String line) {
        return line.replaceFirst("^#{1,6}\\s+", "")
                .replaceFirst("^[-*+]\\s+", "")
                .replaceFirst("^\\d+\\.\\s+", "")
                .replaceAll("[`*_~]", "").trim();
    }

    private Map<String, byte[]> unzip(byte[] bytes) throws IOException {
        Map<String, byte[]> files = new HashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                if (!entry.isDirectory()) files.put(entry.getName(), in.readAllBytes());
            }
        }
        return files;
    }

    private Document parseXml(byte[] xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    }

    private String nodeText(Node node) {
        StringBuilder value = new StringBuilder();
        collectText(node, value);
        return value.toString();
    }

    private void collectText(Node node, StringBuilder value) {
        if (node.getNodeType() == Node.ELEMENT_NODE && "t".equals(node.getLocalName())) value.append(node.getTextContent());
        else for (Node child = node.getFirstChild(); child != null; child = child.getNextSibling()) collectText(child, value);
    }

    private void put(ZipOutputStream zip, String name, String text) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(text.strip().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String columnName(int column) {
        StringBuilder name = new StringBuilder();
        while (column > 0) { column--; name.insert(0, (char) ('A' + (column % 26))); column /= 26; }
        return name.toString();
    }

    private int columnIndex(String ref) {
        Matcher matcher = Pattern.compile("([A-Z]+)").matcher(ref.toUpperCase(Locale.ROOT));
        if (!matcher.find()) return 0;
        int result = 0;
        for (char ch : matcher.group(1).toCharArray()) result = result * 26 + (ch - 'A' + 1);
        return result - 1;
    }

    private String htmlEscape(String value) {
        return Optional.ofNullable(value).orElse("")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String xmlEscape(String value) {
        return Optional.ofNullable(value).orElse("")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    public record ImportedMarkdown(String title, String markdown, String sourceType) {}
}
