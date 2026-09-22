import type { Status } from '../lib/types';

const LABELS: Record<string, string> = {
  missing: 'Missing',
  valid: 'Valid',
  expired: 'Expired',
  flagged: 'Flagged',
  pending_approval: 'Pending Approval',
  non_compliant: 'Non-Compliant',
  tampered: 'Tampered',
  legal_hold: 'Legal Hold',
  in_review: 'In Review',
};

export function statusLabel(status: string): string {
  return LABELS[status] || status;
}

export function StatusBadge({ status }: { status: Status | string }) {
  return (
    <span className={`badge st-${status}`}>
      <span className="dot" />
      {statusLabel(status)}
    </span>
  );
}

export default StatusBadge;
