import type { DetailField, Details, NewRecord, Status } from './types';
import { DETAIL_FIELDS, emptyDetails, isStatus } from './types';

const ALIASES: Record<string, DetailField> = {
  document_id: 'document_id',
  doc_id: 'document_id',
  document_name: 'document_name',
  doc_name: 'document_name',
  file_name: 'document_name',
  filename: 'document_name',
  document_type: 'document_type',
  doc_type: 'document_type',
  type: 'document_type',
  regulation_framework: 'regulation_framework',
  regulation: 'regulation_framework',
  framework: 'regulation_framework',
  control_id: 'control_id',
  control: 'control_id',
  control_description: 'control_description',
  description: 'control_description',
  assigned_owner: 'assigned_owner',
  owner: 'assigned_owner',
  assignee: 'assigned_owner',
  department: 'department',
  dept: 'department',
  evidence_location: 'evidence_location',
  location: 'evidence_location',
  evidence_link: 'evidence_location',
  last_reviewed_date: 'last_reviewed_date',
  last_reviewed: 'last_reviewed_date',
  next_review_due_date: 'next_review_due_date',
  next_review: 'next_review_due_date',
  review_due_date: 'next_review_due_date',
  due_date: 'next_review_due_date',
  expiration_date: 'expiration_date',
  expiry_date: 'expiration_date',
  expires: 'expiration_date',
  approval_status: 'approval_status',
  approval: 'approval_status',
  approver: 'approver',
  approved_by: 'approver',
  risk_level: 'risk_level',
  risk: 'risk_level',
  notes: 'notes',
  comment: 'notes',
  comments: 'notes',
};

function normKey(key: string): DetailField | null {
  const clean = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ALIASES[clean] || null;
}

function cleanValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function normalizeDate(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function resolveStatus(raw: string, row: Record<string, string>): Status {
  const candidate = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (isStatus(candidate)) return candidate;
  if (candidate === 'complete' || candidate === 'approved' || candidate === 'compliant')
    return 'valid';
  if (candidate === 'overdue' || candidate === 'lapsed') return 'expired';
  if (candidate === 'pending' || candidate === 'awaiting_approval') return 'pending_approval';
  if (candidate === 'hold') return 'legal_hold';
  if (candidate === 'review') return 'in_review';
  const exp = normalizeDate(row.expiration_date || '');
  if (exp) {
    const today = new Date().toISOString().slice(0, 10);
    return exp < today ? 'expired' : 'valid';
  }
  const next = normalizeDate(row.next_review_due_date || '');
  if (next) {
    const today = new Date().toISOString().slice(0, 10);
    return next < today ? 'expired' : 'valid';
  }
  return 'missing';
}

function buildRecord(cells: Record<string, string>): NewRecord {
  const details: Details = emptyDetails();
  for (const field of DETAIL_FIELDS) details[field] = '';
  for (const [rawKey, rawVal] of Object.entries(cells)) {
    const field = normKey(rawKey);
    if (field) details[field] = cleanValue(rawVal);
  }
  details.next_review_due_date = normalizeDate(
    details.next_review_due_date || '',
  );
  details.expiration_date = normalizeDate(details.expiration_date || '');
  details.last_reviewed_date = normalizeDate(details.last_reviewed_date || '');

  const status = resolveStatus(cells.status || cells.state || '', details);

  const title =
    details.assigned_owner ||
    details.control_id ||
    details.document_name ||
    'Unknown Entity';

  const due =
    details.next_review_due_date || details.expiration_date || null;

  return { title, status, details, due_date: due };
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function detectDelimiter(header: string): string {
  const counts: Record<string, number> = {
    ',': (header.match(/,/g) || []).length,
    '\t': (header.match(/\t/g) || []).length,
    ';': (header.match(/;/g) || []).length,
    '|': (header.match(/\|/g) || []).length,
  };
  let best = ',';
  let max = 0;
  for (const [d, n] of Object.entries(counts)) {
    if (n > max) {
      max = n;
      best = d;
    }
  }
  return best;
}

function rowsToRecords(rows: string[][]): NewRecord[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const records: NewRecord[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const cells: Record<string, string> = {};
    header.forEach((h, idx) => {
      cells[h] = row[idx] ?? '';
    });
    if (Object.values(cells).every((v) => !String(v).trim())) continue;
    const rec = buildRecord(cells);
    if (
      !rec.details.document_name &&
      !rec.details.control_id &&
      !rec.details.assigned_owner &&
      rec.title === 'Unknown Entity'
    ) {
      continue;
    }
    records.push(rec);
  }
  return records;
}

export function parseCSV(text: string): NewRecord[] {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  return rowsToRecords(parseDelimited(text, delimiter));
}

export function parseKeyValue(text: string): NewRecord[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const records: NewRecord[] = [];
  for (const block of blocks) {
    const cells: Record<string, string> = {};
    for (const line of block.split(/\r?\n/)) {
      const match = line.match(/^\s*([^:]+):\s*(.*)$/);
      if (match) {
        cells[match[1]] = match[2];
        if (/^status$/i.test(match[1].trim())) cells.status = match[2];
      }
    }
    if (Object.keys(cells).length >= 2) records.push(buildRecord(cells));
  }
  return records;
}

export function parseJSONText(text: string): NewRecord[] {
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { records?: unknown[] }).records)
        ? (parsed as { records: unknown[] }).records
        : [parsed];
    const records: NewRecord[] = [];
    for (const item of arr) {
      if (item && typeof item === 'object') {
        const cells: Record<string, string> = {};
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          cells[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : cleanValue(v);
        }
        if (Object.keys(cells).length > 0) records.push(buildRecord(cells));
      }
    }
    return records;
  } catch {
    return [];
  }
}

export function parseLooseText(text: string, fileName: string): NewRecord[] {
  const kv = parseKeyValue(text);
  if (kv.length > 0) return kv;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const details = emptyDetails();
  details.document_name = fileName;
  details.notes = lines.slice(0, 6).join(' ');
  details.document_type = 'Unstructured Upload';
  return [
    {
      title: 'Unknown Entity',
      status: 'missing',
      details,
      due_date: null,
    },
  ];
}

export interface ExtractResult {
  records: NewRecord[];
  source: string;
  warning?: string;
}

export async function extractFromText(
  text: string,
  fileName: string,
): Promise<ExtractResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { records: [], source: 'empty', warning: 'File was empty.' };
  }
  const csv = parseCSV(trimmed);
  if (csv.length > 0) return { records: csv, source: 'csv' };
  const json = parseJSONText(trimmed);
  if (json.length > 0) return { records: json, source: 'json' };
  const kv = parseKeyValue(trimmed);
  if (kv.length > 0) return { records: kv, source: 'key-value' };
  return {
    records: parseLooseText(trimmed, fileName),
    source: 'text',
    warning:
      'No tabular structure detected. Captured the document as a single review item.',
  };
}
