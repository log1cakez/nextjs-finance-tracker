import { asc, eq } from "drizzle-orm";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { getDb } from "@/db";
import { accountTransfers, categories, financialAccounts, transactions } from "@/db/schema";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import { normalizeFinancialAccountRow } from "@/lib/financial-account-crypto";
import {
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { formatTypedLabel } from "@/lib/typed-label-format";
import { decryptTransactionPayload, encryptTransactionPayload } from "@/lib/transaction-crypto";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const FLAT_ENTRY_HEADERS = [
  "Date",
  "Day",
  "Value",
  "Category",
  "Description",
  "Mode of Payment",
  "Currency",
] as const;

const ENTRY_ROWS_PER_DAY = 115;
const FLAT_ENTRY_ROWS = ENTRY_ROWS_PER_DAY * WEEKDAYS.length;

type SheetValue = string | number | XLSX.CellObject;

type ListItem = {
  id: string;
  name: string;
  kind?: "income" | "expense";
};

type ParsedImportRow = {
  date: string;
  amountCents: number;
  categoryId: string | null;
  categoryName: string;
  kind: "income" | "expense";
  accountId: string;
  accountName: string;
  description: string;
  currency: FiatCurrency;
};

export type DailyExpenseImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sundayOfWeek(d = new Date()): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function importDuplicateKey(parts: {
  date: string;
  amountCents: number;
  currency: FiatCurrency;
  kind: "income" | "expense";
  description: string;
  accountId: string | null;
}): string {
  return [
    parts.date,
    parts.amountCents,
    parts.currency,
    parts.kind,
    normalizeKey(parts.description),
    parts.accountId ?? "",
  ].join("|");
}

function cellToIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return isoDate(new Date(parsed.y, parsed.m - 1, parsed.d, 12));
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return trimmed;
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return isoDate(d);
  }
  return null;
}

function amountToMinor(value: unknown): number | null {
  if (typeof value === "number") {
    return value > 0 ? Math.round(value * 100) : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[,$₱]/g, "").trim();
    return parseAmountToMinor(cleaned);
  }
  return null;
}

function getCellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return isoDate(value);
  return String(value).trim();
}

function appendSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: SheetValue[][],
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, name);
  return ws;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dataValidationXml(
  sqref: string,
  formula: string,
  promptTitle: string,
  prompt: string,
): string {
  return `<dataValidation type="list" allowBlank="1" showDropDown="0" showErrorMessage="1" showInputMessage="1" sqref="${sqref}" promptTitle="${xmlEscape(promptTitle)}" prompt="${xmlEscape(prompt)}"><formula1>${xmlEscape(formula)}</formula1></dataValidation>`;
}

function injectBeforeWorksheetExt(xml: string, fragment: string): string {
  const ignoredErrorsIndex = xml.indexOf("<ignoredErrors>");
  if (ignoredErrorsIndex >= 0) {
    return `${xml.slice(0, ignoredErrorsIndex)}${fragment}${xml.slice(ignoredErrorsIndex)}`;
  }
  return xml.replace("</worksheet>", `${fragment}</worksheet>`);
}

async function addDropdownsToWorkbook(
  buffer: Buffer,
  options: { categoryCount: number; accountCount: number },
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  zip.file("xl/styles.xml", buildWorkbookStylesXml());
  const categoryEnd = Math.max(options.categoryCount + 1, 2);
  const accountEnd = Math.max(options.accountCount + 1, 2);
  const categoryRange = `Lists!$A$2:$A$${categoryEnd}`;
  const accountRange = `Lists!$B$2:$B$${accountEnd}`;
  const validations = [
    dataValidationXml(
      `B2:B${ENTRY_ROWS_PER_DAY + 1}`,
      categoryRange,
      "Category",
      "Choose one of your app income or expense categories.",
    ),
    dataValidationXml(
      `D2:D${ENTRY_ROWS_PER_DAY + 1}`,
      accountRange,
      "Mode of Payment",
      "Choose one of your app accounts.",
    ),
  ].join("");
  const validationBlock = `<dataValidations count="2">${validations}</dataValidations>`;

  // Sheet order: Weekly Summary = 1, Sunday-Saturday = 2-8.
  for (let sheetNumber = 2; sheetNumber <= 8; sheetNumber++) {
    const path = `xl/worksheets/sheet${sheetNumber}.xml`;
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(
      path,
      styleWeekdaySheetXml(injectBeforeWorksheetExt(xml, validationBlock)),
    );
  }

  await styleSheetXml(zip, "xl/worksheets/sheet1.xml", styleSummarySheetXml);
  await styleSheetXml(zip, "xl/worksheets/sheet9.xml", styleEntriesSheetXml);
  await styleSheetXml(zip, "xl/worksheets/sheet10.xml", styleListsSheetXml);
  await styleSheetXml(zip, "xl/worksheets/sheet11.xml", styleTransfersSheetXml);

  return zip.generateAsync({ type: "nodebuffer" });
}

async function styleSheetXml(
  zip: JSZip,
  path: string,
  styleFn: (xml: string) => string,
): Promise<void> {
  const file = zip.file(path);
  if (!file) return;
  zip.file(path, styleFn(await file.async("string")));
}

function buildWorkbookStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="FF92400E"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF92400E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8E7C5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/>
</styleSheet>`;
}

function setCellStyle(xml: string, cellRef: string, styleId: number): string {
  const pattern = new RegExp(`<c r="${cellRef}"(?: s="\\d+")?`, "g");
  return xml.replace(pattern, `<c r="${cellRef}" s="${styleId}"`);
}

function setRangeStyle(
  xml: string,
  columns: string[],
  startRow: number,
  endRow: number,
  styleId: number,
): string {
  let out = xml;
  for (let row = startRow; row <= endRow; row++) {
    for (const col of columns) {
      out = setCellStyle(out, `${col}${row}`, styleId);
    }
  }
  return out;
}

function addRowHeights(xml: string, rows: Record<number, number>): string {
  let out = xml;
  for (const [row, height] of Object.entries(rows)) {
    const re = new RegExp(`<row r="${row}"([^>]*)>`, "g");
    out = out.replace(re, (match, attrs: string) => {
      const cleanAttrs = attrs
        .replace(/\sht="[^"]*"/g, "")
        .replace(/\scustomHeight="[^"]*"/g, "");
      return `<row r="${row}"${cleanAttrs} ht="${height}" customHeight="1">`;
    });
  }
  return out;
}

function styleSummarySheetXml(xml: string): string {
  let out = xml;
  out = setRangeStyle(out, ["A", "B", "C", "D", "E", "F", "G", "H"], 1, 1, 1);
  out = setRangeStyle(out, ["A", "B"], 2, 2, 6);
  out = setRangeStyle(out, ["A", "B", "C", "E", "F", "G", "H"], 4, 4, 2);
  out = setRangeStyle(out, ["A", "B", "C"], 5, 11, 4);
  out = setRangeStyle(out, ["E", "F", "G", "H"], 5, 200, 4);
  out = setRangeStyle(out, ["A", "B", "C"], 12, 12, 8);
  return addRowHeights(out, { 1: 28, 4: 22 });
}

function styleWeekdaySheetXml(xml: string): string {
  let out = xml;
  out = setRangeStyle(out, ["A", "B", "C", "D"], 1, 1, 2);
  out = setRangeStyle(out, ["A", "B", "C", "D"], 2, ENTRY_ROWS_PER_DAY + 1, 5);
  return addRowHeights(out, { 1: 23 });
}

function styleEntriesSheetXml(xml: string): string {
  let out = xml;
  out = setRangeStyle(out, ["A", "B", "C", "D", "E", "F", "G"], 1, 1, 2);
  out = setRangeStyle(out, ["A", "B", "C", "D", "E", "F", "G"], 2, FLAT_ENTRY_ROWS + 1, 7);
  return addRowHeights(out, { 1: 23 });
}

function styleListsSheetXml(xml: string): string {
  let out = xml;
  out = setRangeStyle(out, ["A", "B", "C"], 1, 1, 2);
  out = setRangeStyle(out, ["A", "B", "C"], 2, 300, 7);
  return addRowHeights(out, { 1: 23 });
}

function styleTransfersSheetXml(xml: string): string {
  let out = xml;
  out = setRangeStyle(out, ["A", "B", "C", "D", "E", "F"], 1, 1, 2);
  out = setRangeStyle(out, ["A", "B", "C", "D", "E", "F"], 2, 500, 7);
  return addRowHeights(out, { 1: 23 });
}

function parseRowsFromSheet(
  sheetName: string,
  rows: Record<string, unknown>[],
  categoryByName: Map<string, ListItem>,
  accountByName: Map<string, ListItem>,
  defaultDate?: string | null,
): { parsedRows: ParsedImportRow[]; errors: string[] } {
  const parsedRows: ParsedImportRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const humanRow = idx + 2;
    const date = cellToIsoDate(row.Date) ?? defaultDate ?? null;
    const amountCents = amountToMinor(row.Value);
    const categoryName = getCellText(row.Category);
    const accountName = getCellText(row["Mode of Payment"]);
    const description = formatTypedLabel(getCellText(row.Description));
    const currencyRaw = getCellText(row.Currency).toUpperCase();
    const currency = SUPPORTED_CURRENCIES.includes(currencyRaw as FiatCurrency)
      ? (currencyRaw as FiatCurrency)
      : "PHP";

    const hasAnyData =
      date ||
      amountCents != null ||
      categoryName ||
      accountName ||
      description ||
      getCellText(row.Value);
    if (!hasAnyData || amountCents == null) return;

    if (!date) {
      errors.push(`${sheetName} row ${humanRow}: Date is required.`);
      return;
    }
    if (!description) {
      errors.push(`${sheetName} row ${humanRow}: Description is required.`);
      return;
    }
    const category = categoryName
      ? categoryByName.get(normalizeKey(categoryName))
      : null;
    if (categoryName && !category) {
      errors.push(`${sheetName} row ${humanRow}: Unknown category "${categoryName}".`);
      return;
    }
    const account = accountByName.get(normalizeKey(accountName));
    if (!account) {
      errors.push(`${sheetName} row ${humanRow}: Unknown payment mode "${accountName}".`);
      return;
    }

    parsedRows.push({
      date,
      amountCents,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? "",
      kind: category?.kind ?? "expense",
      accountId: account.id,
      accountName: account.name,
      description,
      currency,
    });
  });

  return { parsedRows, errors };
}

async function dbQueryAllTransfers(userId: string) {
  const db = getDb();
  return db.query.accountTransfers.findMany({
    where: eq(accountTransfers.userId, userId),
    orderBy: [asc(accountTransfers.occurredAt)],
    with: { fromAccount: true, toAccount: true },
  });
}

async function getExpenseCategoriesAndAccounts(userId: string): Promise<{
  categoriesList: ListItem[];
  accounts: ListItem[];
}> {
  const db = getDb();
  const [categoryRows, accountRows] = await Promise.all([
    db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: [asc(categories.kind), asc(categories.name)],
    }),
    db.query.financialAccounts.findMany({
      where: eq(financialAccounts.userId, userId),
      orderBy: [asc(financialAccounts.type), asc(financialAccounts.createdAt)],
    }),
  ]);

  const categoryNameCounts = new Map<string, number>();
  for (const c of categoryRows) {
    const key = normalizeKey(c.name);
    categoryNameCounts.set(key, (categoryNameCounts.get(key) ?? 0) + 1);
  }

  return {
    categoriesList: categoryRows.map((c) => {
      const duplicateName = (categoryNameCounts.get(normalizeKey(c.name)) ?? 0) > 1;
      return {
        id: c.id,
        name: duplicateName
          ? `${c.name} (${c.kind === "income" ? "Income" : "Expense"})`
          : c.name,
        kind: c.kind,
      };
    }),
    accounts: accountRows
      .map((a) => normalizeFinancialAccountRow(userId, a))
      .map((a) => ({ id: a.id, name: decryptFinancePlaintext(userId, a.name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function buildDailyExpenseTrackerXlsxBuffer(
  userId: string,
  options: { preferredCurrency: FiatCurrency; weekStart?: Date },
): Promise<Buffer> {
  const [{ categoriesList, accounts }, allTransfers] = await Promise.all([
    getExpenseCategoriesAndAccounts(userId),
    dbQueryAllTransfers(userId),
  ]);
  const weekStart = sundayOfWeek(options.weekStart);
  const wb = XLSX.utils.book_new();

  const summaryRows: SheetValue[][] = [
    ["Weekly Expense Summary", "", "", "", "", "", "", ""],
    ["Week starting", isoDate(weekStart), "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["Day", "Date", "Total", "", "Category", "Weekly Total", "Mode of Payment", "Weekly Total"],
  ];

  WEEKDAYS.forEach((day, i) => {
    const rowNumber = i + 5;
    const listName = i < categoriesList.length ? categoriesList[i].name : "";
    const accountName = i < accounts.length ? accounts[i].name : "";
    summaryRows.push([
      day,
      isoDate(addDays(weekStart, i)),
      { t: "n", f: `SUM('${day}'!A2:A${ENTRY_ROWS_PER_DAY + 1})` },
      "",
      listName,
      listName ? { t: "n", f: `SUMIF(Monday!B:B,E${rowNumber},Monday!A:A)+SUMIF(Tuesday!B:B,E${rowNumber},Tuesday!A:A)+SUMIF(Wednesday!B:B,E${rowNumber},Wednesday!A:A)+SUMIF(Thursday!B:B,E${rowNumber},Thursday!A:A)+SUMIF(Friday!B:B,E${rowNumber},Friday!A:A)+SUMIF(Saturday!B:B,E${rowNumber},Saturday!A:A)+SUMIF(Sunday!B:B,E${rowNumber},Sunday!A:A)` } : "",
      accountName,
      accountName ? { t: "n", f: `SUMIF(Monday!D:D,G${rowNumber},Monday!A:A)+SUMIF(Tuesday!D:D,G${rowNumber},Tuesday!A:A)+SUMIF(Wednesday!D:D,G${rowNumber},Wednesday!A:A)+SUMIF(Thursday!D:D,G${rowNumber},Thursday!A:A)+SUMIF(Friday!D:D,G${rowNumber},Friday!A:A)+SUMIF(Saturday!D:D,G${rowNumber},Saturday!A:A)+SUMIF(Sunday!D:D,G${rowNumber},Sunday!A:A)` } : "",
    ]);
  });
  const maxListRows = Math.max(categoriesList.length, accounts.length);
  for (let i = WEEKDAYS.length; i < maxListRows; i++) {
    const rowNumber = i + 5;
    const listName = i < categoriesList.length ? categoriesList[i].name : "";
    const accountName = i < accounts.length ? accounts[i].name : "";
    summaryRows.push([
      "",
      "",
      "",
      "",
      listName,
      listName ? { t: "n", f: `SUMIF(Monday!B:B,E${rowNumber},Monday!A:A)+SUMIF(Tuesday!B:B,E${rowNumber},Tuesday!A:A)+SUMIF(Wednesday!B:B,E${rowNumber},Wednesday!A:A)+SUMIF(Thursday!B:B,E${rowNumber},Thursday!A:A)+SUMIF(Friday!B:B,E${rowNumber},Friday!A:A)+SUMIF(Saturday!B:B,E${rowNumber},Saturday!A:A)+SUMIF(Sunday!B:B,E${rowNumber},Sunday!A:A)` } : "",
      accountName,
      accountName ? { t: "n", f: `SUMIF(Monday!D:D,G${rowNumber},Monday!A:A)+SUMIF(Tuesday!D:D,G${rowNumber},Tuesday!A:A)+SUMIF(Wednesday!D:D,G${rowNumber},Wednesday!A:A)+SUMIF(Thursday!D:D,G${rowNumber},Thursday!A:A)+SUMIF(Friday!D:D,G${rowNumber},Friday!A:A)+SUMIF(Saturday!D:D,G${rowNumber},Saturday!A:A)+SUMIF(Sunday!D:D,G${rowNumber},Sunday!A:A)` } : "",
    ]);
  }
  summaryRows.push([
    "Grand Total",
    "",
    { t: "n", f: "SUM(C5:C11)" },
    "",
    "",
    "",
    "",
    "",
  ]);
  const summary = appendSheet(wb, "Weekly Summary", summaryRows);
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  summary["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 3 },
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
  ];

  WEEKDAYS.forEach((day, i) => {
    const date = isoDate(addDays(weekStart, i));
    const rows: SheetValue[][] = [
      ["Value", "Category", "Description", "Mode of Payment"],
    ];
    for (let r = 0; r < ENTRY_ROWS_PER_DAY; r++) {
      rows.push(["", "", "", ""]);
    }
    const ws = appendSheet(wb, day, rows);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 24 },
      { wch: 36 },
      { wch: 28 },
    ];
  });

  const flatRows: SheetValue[][] = [Array.from(FLAT_ENTRY_HEADERS)];
  WEEKDAYS.forEach((day, dayIndex) => {
    for (let r = 0; r < ENTRY_ROWS_PER_DAY; r++) {
      const sourceRow = r + 2;
      flatRows.push([
        isoDate(addDays(weekStart, dayIndex)),
        day,
        { t: "n", f: `'${day}'!A${sourceRow}` },
        { t: "s", f: `'${day}'!B${sourceRow}` },
        { t: "s", f: `'${day}'!C${sourceRow}` },
        { t: "s", f: `'${day}'!D${sourceRow}` },
        options.preferredCurrency,
      ]);
    }
  });
  const flat = appendSheet(wb, "Entries", flatRows);
  flat["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 36 },
    { wch: 28 },
    { wch: 10 },
  ];

  const listsRows: SheetValue[][] = [["Categories", "Payment Modes", "Kind"]];
  const listRows = Math.max(categoriesList.length, accounts.length);
  for (let i = 0; i < listRows; i++) {
    listsRows.push([
      categoriesList[i]?.name ?? "",
      accounts[i]?.name ?? "",
      categoriesList[i]?.kind ?? "",
    ]);
  }
  const lists = appendSheet(wb, "Lists", listsRows);
  lists["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 10 }];

  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
  const weekTransfers = allTransfers.filter((t) => {
    const d = new Date(t.occurredAt);
    return d >= weekStart && d <= weekEnd;
  });
  const transferSheetRows: SheetValue[][] = [
    ["Date", "From Account", "To Account", "Amount", "Currency", "Description"],
  ];
  for (const t of weekTransfers) {
    if (!t.fromAccount || !t.toAccount) continue;
    let description = "";
    try {
      description = decryptTransactionPayload(userId, t.payload).description;
    } catch { /* ignore */ }
    const fromName = decryptFinancePlaintext(userId, t.fromAccount.name);
    const toName = decryptFinancePlaintext(userId, t.toAccount.name);
    const amount = transferAmountCentsFromRow(userId, { amountCents: t.amountCents, payload: t.payload }) / 100;
    transferSheetRows.push([isoDate(new Date(t.occurredAt)), fromName, toName, amount, t.currency, description]);
  }
  const transfersWs = appendSheet(wb, "Transfers", transferSheetRows);
  transfersWs["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 28 },
    { wch: 12 },
    { wch: 10 },
    { wch: 36 },
  ];

  wb.Workbook = wb.Workbook ?? {};
  wb.Workbook.Sheets = wb.SheetNames.map((name) => ({
    name,
    Hidden: name === "Entries" || name === "Lists" ? 1 : 0,
  }));

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return addDropdownsToWorkbook(buffer, {
    categoryCount: categoriesList.length,
    accountCount: accounts.length,
  });
}

function weekdayDateFromSummary(wb: XLSX.WorkBook, weekdayIndex: number): string | null {
  const summary = wb.Sheets["Weekly Summary"];
  if (!summary) return null;
  return cellToIsoDate(summary[`B${weekdayIndex + 5}`]?.v);
}

export async function importDailyExpenseTrackerXlsx(
  userId: string,
  buffer: Buffer,
): Promise<DailyExpenseImportResult> {
  const db = getDb();
  const { categoriesList, accounts } =
    await getExpenseCategoriesAndAccounts(userId);
  const categoryByName = new Map(
    categoriesList.map((c) => [normalizeKey(c.name), c]),
  );
  const accountByName = new Map(accounts.map((a) => [normalizeKey(a.name), a]));
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const parsedRows: ParsedImportRow[] = [];
  const errors: string[] = [];

  const entriesSheet = wb.Sheets.Entries;
  if (entriesSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(entriesSheet, {
      defval: "",
      raw: true,
    });
    const parsed = parseRowsFromSheet(
      "Entries",
      rows,
      categoryByName,
      accountByName,
    );
    parsedRows.push(...parsed.parsedRows);
    errors.push(...parsed.errors);
  }

  if (parsedRows.length === 0 && errors.length === 0) {
    for (const sheetName of WEEKDAYS) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: true,
      });
      const parsed = parseRowsFromSheet(
        sheetName,
        rows,
        categoryByName,
        accountByName,
        weekdayDateFromSummary(wb, WEEKDAYS.indexOf(sheetName)),
      );
      parsedRows.push(...parsed.parsedRows);
      errors.push(...parsed.errors);
    }
  }

  if (errors.length > 0) {
    return { imported: 0, skipped: 0, errors };
  }

  const existingRows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
  });
  const existingSignatures = new Set(
    existingRows.map((row) => {
      const tx = toDecryptedTransaction(userId, row);
      return importDuplicateKey({
        date: isoDate(new Date(tx.occurredAt)),
        amountCents: tx.amountCents,
        currency: tx.currency,
        kind: tx.kind,
        description: tx.description,
        accountId: row.financialAccountId,
      });
    }),
  );

  let imported = 0;
  let skipped = 0;
  const seenInWorkbook = new Set<string>();
  for (const row of parsedRows) {
    const signature = importDuplicateKey({
      date: row.date,
      amountCents: row.amountCents,
      currency: row.currency,
      kind: row.kind,
      description: row.description,
      accountId: row.accountId,
    });
    if (existingSignatures.has(signature) || seenInWorkbook.has(signature)) {
      skipped += 1;
      continue;
    }
    seenInWorkbook.add(signature);

    const payload = encryptTransactionPayload(userId, {
      description: row.description,
      amountCents: row.amountCents,
    });
    await db.insert(transactions).values({
      userId,
      payload,
      description: null,
      amountCents: null,
      currency: row.currency,
      kind: row.kind,
      categoryId: row.categoryId,
      financialAccountId: row.accountId,
      reducesCreditBalance: false,
      occurredAt: new Date(`${row.date}T12:00:00`),
    });
    existingSignatures.add(signature);
    imported += 1;
  }

  return { imported, skipped, errors: [] };
}
