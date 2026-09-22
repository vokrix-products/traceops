export const STATUSES = [
  'missing',
  'valid',
  'expired',
  'flagged',
  'pending_approval',
  'non_compliant',
  'tampered',
  'legal_hold',
  'in_review',
] as const;

export type Status = (typeof STATUSES)[number];

export const DETAIL_FIELDS = [
  'document_id',
  'document_name',
  'document_type',
  'regulation_framework',
  'control_id',
  'control_description',
  'assigned_owner',
  'department',
  'evidence_location',
  'last_reviewed_date',
  'next_review_due_date',
  'expiration_date',
  'approval_status',
  'approver',
  'risk_level',
  'notes',
] as const;

export type DetailField = (typeof DETAIL_FIELDS)[number];

export type Details = Record<string, string>;

export interface Record {
  id: string;
  title: string;
  status: Status;
  details: Details;
  due_date: string | null;
}

export type NewRecord = Omit<Record, 'id'>;

export interface AuditEvent {
  id: string;
  record_id: string;
  type: 'created' | 'status_changed' | 'updated' | 'approved' | 'rejected' | 'redacted' | 'hold';
  message: string;
  actor: string;
  at: string;
}

export interface AppUser {
  id: string;
  email: string;
  local: boolean;
}

export function emptyDetails(): Details {
  const d: Details = {};
  for (const f of DETAIL_FIELDS) d[f] = '';
  return d;
}

export function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

export function normalizeTitle(details: Details, fallback?: string): string {
  const candidates = [
    details.assigned_owner,
    details.control_id,
    details.document_name,
    fallback,
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }
  return 'Unknown Entity';
}

export function ISO_DATE_RE(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
}
