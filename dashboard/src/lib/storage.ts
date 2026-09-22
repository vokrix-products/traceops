import { supabase, hasSupabase } from './supabase';
import type { AuditEvent, NewRecord, Record } from './types';
import { isStatus } from './types';

const RECORDS_KEY = 'traceops.records.v1';
const AUDIT_KEY = 'traceops.audit.v1';

function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

function coerceRecord(row: Record): Record {
  return {
    id: row.id,
    title: row.title || 'Unknown Entity',
    status: isStatus(row.status) ? row.status : 'missing',
    details: row.details || {},
    due_date: row.due_date ?? null,
  };
}

async function remoteList(): Promise<Record[] | null> {
  if (!hasSupabase || !supabase) return null;
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return null;
  return (data || []).map((r) => coerceRecord(r as Record));
}

export async function listRecords(): Promise<Record[]> {
  const remote = await remoteList();
  if (remote) {
    writeLocal(RECORDS_KEY, remote);
    return remote;
  }
  return readLocal<Record>(RECORDS_KEY).map(coerceRecord);
}

export async function countRecords(): Promise<number> {
  return (await listRecords()).length;
}

export async function insertRecords(
  rows: NewRecord[],
  actor: string,
): Promise<Record[]> {
  const withIds: Record[] = rows.map((r) => ({ ...r, id: uid() }));
  if (hasSupabase && supabase) {
    const payload = withIds.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      details: r.details,
      due_date: r.due_date,
    }));
    const { error } = await supabase.from('records').insert(payload);
    if (!error) {
      await logAudit(
        withIds.map((r) => ({
          id: uid(),
          record_id: r.id,
          type: 'created' as const,
          message: `Ingested evidence for ${r.title}`,
          actor,
          at: new Date().toISOString(),
        })),
      );
      return withIds;
    }
  }
  const current = readLocal<Record>(RECORDS_KEY);
  const next = [...withIds, ...current];
  writeLocal(RECORDS_KEY, next);
  const events: AuditEvent[] = withIds.map((r) => ({
    id: uid(),
    record_id: r.id,
    type: 'created',
    message: `Ingested evidence for ${r.title}`,
    actor,
    at: new Date().toISOString(),
  }));
  writeLocal(AUDIT_KEY, [...events, ...readLocal<AuditEvent>(AUDIT_KEY)]);
  return withIds;
}

export async function getRecord(id: string): Promise<Record | null> {
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return coerceRecord(data as Record);
  }
  const all = readLocal<Record>(RECORDS_KEY);
  return all.find((r) => r.id === id) || null;
}

export async function updateRecord(
  id: string,
  patch: Partial<Record>,
  actor: string,
  eventType: AuditEvent['type'] = 'updated',
): Promise<Record | null> {
  const current = await getRecord(id);
  if (!current) return null;
  const next: Record = coerceRecord({ ...current, ...patch });
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('records')
      .update({
        title: next.title,
        status: next.status,
        details: next.details,
        due_date: next.due_date,
      })
      .eq('id', id);
    if (!error) {
      await logAudit([
        {
          id: uid(),
          record_id: id,
          type: eventType,
          message:
            current.status !== next.status
              ? `Status changed from ${current.status} to ${next.status}`
              : `Record updated`,
          actor,
          at: new Date().toISOString(),
        },
      ]);
      return next;
    }
  }
  const all = readLocal<Record>(RECORDS_KEY).map((r) =>
    r.id === id ? next : r,
  );
  writeLocal(RECORDS_KEY, all);
  writeLocal(AUDIT_KEY, [
    {
      id: uid(),
      record_id: id,
      type: eventType,
      message:
        current.status !== next.status
          ? `Status changed from ${current.status} to ${next.status}`
          : `Record updated`,
      actor,
      at: new Date().toISOString(),
    },
    ...readLocal<AuditEvent>(AUDIT_KEY),
  ]);
  return next;
}

export async function deleteRecord(id: string, actor: string): Promise<void> {
  if (hasSupabase && supabase) {
    const { error } = await supabase.from('records').delete().eq('id', id);
    if (!error) {
      await logAudit([
        {
          id: uid(),
          record_id: id,
          type: 'updated',
          message: 'Record deleted',
          actor,
          at: new Date().toISOString(),
        },
      ]);
      return;
    }
  }
  writeLocal(
    RECORDS_KEY,
    readLocal<Record>(RECORDS_KEY).filter((r) => r.id !== id),
  );
}

export async function logAudit(events: AuditEvent[]): Promise<void> {
  if (hasSupabase && supabase) {
    const { error } = await supabase.from('audit_events').insert(events);
    if (!error) return;
  }
  writeLocal(AUDIT_KEY, [...events, ...readLocal<AuditEvent>(AUDIT_KEY)]);
}

export async function listAudit(recordId?: string): Promise<AuditEvent[]> {
  if (hasSupabase && supabase) {
    let query = supabase
      .from('audit_events')
      .select('*')
      .order('at', { ascending: false });
    if (recordId) query = query.eq('record_id', recordId);
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map((d) => ({
        id: String(d.id),
        record_id: String(d.record_id),
        type: d.type,
        message: d.message,
        actor: d.actor,
        at: d.at,
      })) as AuditEvent[];
      if (!recordId) writeLocal(AUDIT_KEY, mapped);
      return mapped;
    }
  }
  const all = readLocal<AuditEvent>(AUDIT_KEY);
  return recordId ? all.filter((e) => e.record_id === recordId) : all;
}
