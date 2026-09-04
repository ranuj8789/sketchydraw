package com.sketchydraw.markdown.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.*;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.*;

@Service
public class MarkdownDocumentService {

    public byte[] createPdf(String title, String markdown) throws IOException {
        String safeTitle = blankToDefault(title, "Markdown Document");
        List<String> lines = wrapPlainText(safeTitle + "\n\n" + markdownToPlainText(markdown), 92);
        return buildSimplePdf(lines);
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
                      <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
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
        Document doc = parseXml(xml);
        NodeList items = doc.getElementsByTagNameNS("*", "si");
        List<String> values = new ArrayList<>();
        for (int i = 0; i < items.getLength(); i++) values.add(nodeText(items.item(i)));
        return values;
    }

    private List<List<String>> readWorksheet(byte[] xml, List<String> shared) throws Exception {
        if (xml == null) return List.of();
        Document doc = parseXml(xml);
        NodeList rowNodes = doc.getElementsByTagNameNS("*", "row");
        List<List<String>> rows = new ArrayList<>();
        for (int i = 0; i < rowNodes.getLength(); i++) {
            NodeList cells = ((Element) rowNodes.item(i)).getElementsByTagNameNS("*", "c");
            TreeMap<Integer, String> indexed = new TreeMap<>();
            for (int j = 0; j < cells.getLength(); j++) {
                Element cell = (Element) cells.item(j);
                int col = columnIndex(cell.getAttribute("r"));
                String type = cell.getAttribute("t");
                String value;
                if ("inlineStr".equals(type)) {
                    value = nodeText(cell);
                } else {
                    NodeList vs = cell.getElementsByTagNameNS("*", "v");
                    value = vs.getLength() == 0 ? "" : vs.item(0).getTextContent();
                    if ("s".equals(type) && !value.isBlank()) {
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

    private byte[] buildSimplePdf(List<String> lines) throws IOException {
        List<List<String>> pages = new ArrayList<>();
        for (int i = 0; i < lines.size(); i += 46) pages.add(lines.subList(i, Math.min(lines.size(), i + 46)));
        if (pages.isEmpty()) pages.add(List.of(""));

        int pageCount = pages.size();
        int fontObj = 3 + pageCount * 2;
        List<byte[]> objects = new ArrayList<>();
        objects.add("<< /Type /Catalog /Pages 2 0 R >>".getBytes(StandardCharsets.US_ASCII));
        StringBuilder kids = new StringBuilder("[");
        for (int p = 0; p < pageCount; p++) kids.append(3 + p * 2).append(" 0 R ");
        kids.append("]");
        objects.add(("<< /Type /Pages /Kids " + kids + " /Count " + pageCount + " >>").getBytes(StandardCharsets.US_ASCII));

        for (int p = 0; p < pageCount; p++) {
            int pageObj = 3 + p * 2;
            int contentObj = pageObj + 1;
            objects.add(("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 " + fontObj + " 0 R >> >> /Contents " + contentObj + " 0 R >>").getBytes(StandardCharsets.US_ASCII));
            StringBuilder stream = new StringBuilder("BT\n/F1 11 Tf\n50 748 Td\n14 TL\n");
            for (String line : pages.get(p)) stream.append("(").append(pdfEscape(line)).append(") Tj\nT*\n");
            stream.append("ET");
            byte[] body = stream.toString().getBytes(StandardCharsets.ISO_8859_1);
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            content.write(("<< /Length " + body.length + " >>\nstream\n").getBytes(StandardCharsets.US_ASCII));
            content.write(body);
            content.write("\nendstream".getBytes(StandardCharsets.US_ASCII));
            objects.add(content.toByteArray());
        }
        objects.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".getBytes(StandardCharsets.US_ASCII));

        ByteArrayOutputStream pdf = new ByteArrayOutputStream();
        pdf.write("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII));
        List<Integer> offsets = new ArrayList<>();
        offsets.add(0);
        for (int i = 0; i < objects.size(); i++) {
            offsets.add(pdf.size());
            pdf.write(((i + 1) + " 0 obj\n").getBytes(StandardCharsets.US_ASCII));
            pdf.write(objects.get(i));
            pdf.write("\nendobj\n".getBytes(StandardCharsets.US_ASCII));
        }
        int xref = pdf.size();
        pdf.write(("xref\n0 " + (objects.size() + 1) + "\n").getBytes(StandardCharsets.US_ASCII));
        pdf.write("0000000000 65535 f \n".getBytes(StandardCharsets.US_ASCII));
        for (int i = 1; i < offsets.size(); i++) pdf.write(String.format(Locale.ROOT, "%010d 00000 n \n", offsets.get(i)).getBytes(StandardCharsets.US_ASCII));
        pdf.write(("trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF").getBytes(StandardCharsets.US_ASCII));
        return pdf.toByteArray();
    }

    private List<String> wrapPlainText(String text, int width) {
        List<String> result = new ArrayList<>();
        for (String paragraph : text.replace("\r\n", "\n").split("\n", -1)) {
            if (paragraph.isBlank()) { result.add(""); continue; }
            String remaining = paragraph;
            while (remaining.length() > width) {
                int cut = remaining.lastIndexOf(' ', width);
                if (cut < 1) cut = width;
                result.add(remaining.substring(0, cut));
                remaining = remaining.substring(cut).stripLeading();
            }
            result.add(remaining);
        }
        return result;
    }

    private String markdownToPlainText(String md) {
        return Optional.ofNullable(md).orElse("")
                .replaceAll("(?m)^#{1,6}\\s+", "")
                .replaceAll("(?m)^\\s*[-*+]\\s+", "• ")
                .replaceAll("(?m)^\\s*\\d+\\.\\s+", "")
                .replaceAll("[`*_~]", "")
                .replaceAll("\\[([^]]+)]\\(([^)]+)\\)", "$1 ($2)");
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
        Matcher m = Pattern.compile("([A-Z]+)").matcher(ref.toUpperCase(Locale.ROOT));
        if (!m.find()) return 0;
        int result = 0;
        for (char ch : m.group(1).toCharArray()) result = result * 26 + (ch - 'A' + 1);
        return result - 1;
    }

    private String xmlEscape(String value) { return Optional.ofNullable(value).orElse("").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"); }
    private String pdfEscape(String value) { return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replaceAll("[^\\x20-\\x7E]", "?"); }
    private String blankToDefault(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
    private String stripExtension(String name) { int dot = name.lastIndexOf('.'); return dot > 0 ? name.substring(0, dot) : name; }

    public record ImportedMarkdown(String title, String markdown, String sourceType) {}
}
