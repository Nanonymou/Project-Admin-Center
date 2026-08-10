/**
 * Minimal, dependency-free XLSX writer. Builds a valid `.xlsx` (Office Open XML)
 * workbook from a single sheet of rows using a "stored" (uncompressed) ZIP
 * container — enough for exporting mock/report data without pulling in a
 * spreadsheet library. Cells are written as numbers or inline strings.
 *
 * Only the parts Excel needs to open the file are emitted:
 *   [Content_Types].xml, _rels/.rels, xl/workbook.xml,
 *   xl/_rels/workbook.xml.rels, xl/worksheets/sheet1.xml
 */

export type XlsxCell = string | number;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Column index (0-based) → spreadsheet column name (A, B, …, Z, AA, …). */
function colName(index: number): string {
  let n = index;
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function buildColsXml(widths: number[]): string {
  if (widths.length === 0) return "";
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  return `<cols>${cols}</cols>`;
}

function buildSheetXml(rows: XlsxCell[][], widths: number[] = []): string {
  const rowXml = rows
    .map((cells, r) => {
      const cellXml = cells
        .map((value, c) => {
          const ref = `${colName(c)}${r + 1}`;
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cellXml}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${buildColsXml(widths)}<sheetData>${rowXml}</sheetData></worksheet>`;
}

/**
 * A typed column for the record-based builder: a header label, the key used to
 * pull the value from each record, and an optional display width (in Excel
 * character units). Numeric-looking values are written as numbers.
 */
export type XlsxColumn<T> = {
  header: string;
  value: (record: T) => XlsxCell;
  width?: number;
};

/** Turn a typed column spec + records into a header row + data rows and widths. */
export function columnsToRows<T>(
  columns: XlsxColumn<T>[],
  records: T[],
): { rows: XlsxCell[][]; widths: number[] } {
  const header = columns.map((c) => c.header);
  const data = records.map((rec) => columns.map((c) => c.value(rec)));
  const widths = columns.map((c) => c.width ?? Math.max(10, c.header.length + 2));
  return { rows: [header, ...data], widths };
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

function buildWorkbookXml(sheetName: string): string {
  const safe = escapeXml(sheetName).slice(0, 31) || "Sheet1";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safe}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

// --- Minimal "stored" ZIP writer -------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; data: Uint8Array; crc: number };

function zipStore(files: { name: string; content: string }[]): Blob {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = files.map((f) => {
    const data = enc.encode(f.content);
    return { name: f.name, data, crc: crc32(data) };
  });

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(e.crc),
      u32(e.data.length),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      e.data,
    ]);
    chunks.push(local);

    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(e.crc),
        u32(e.data.length),
        u32(e.data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]),
    );
    offset += local.length;
  }

  const centralData = concat(central);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralData.length),
    u32(offset),
    u16(0),
  ]);

  const bytes = concat([...chunks, centralData, eocd]);
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/**
 * Build an XLSX Blob from a single sheet of rows (first row usually a header).
 * Optional per-column widths set the sheet's column display widths.
 */
export function buildXlsxBlob(rows: XlsxCell[][], sheetName = "Sheet1", widths: number[] = []): Blob {
  return zipStore([
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: ROOT_RELS },
    { name: "xl/workbook.xml", content: buildWorkbookXml(sheetName) },
    { name: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS },
    { name: "xl/worksheets/sheet1.xml", content: buildSheetXml(rows, widths) },
  ]);
}

/** Build an XLSX and trigger a browser download. */
export function downloadXlsx(
  filename: string,
  rows: XlsxCell[][],
  sheetName = "Sheet1",
  widths: number[] = [],
): void {
  const blob = buildXlsxBlob(rows, sheetName, widths);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
