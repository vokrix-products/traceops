import csv
import io
import json
import os
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import openpyxl
import pdfplumber
from openai import OpenAI

ALLOWED_STATUSES = {
    "missing",
    "valid",
    "expired",
    "flagged",
    "pending_approval",
    "non_compliant",
    "tampered",
    "legal_hold",
    "in_review",
}

DETAIL_FIELDS = [
    "document_id",
    "document_name",
    "document_type",
    "regulation_framework",
    "control_id",
    "control_description",
    "applicable_agent_ids",
    "assigned_owner",
    "last_reviewed_date",
    "next_review_due_date",
    "expiration_date",
    "evidence_location",
    "evidence_hash",
    "data_classification",
    "retention_period",
    "legal_hold_status",
    "approval_gate_required",
    "risk_level",
]

ALIASES = {
    "id": "document_id",
    "doc_id": "document_id",
    "documentid": "document_id",
    "name": "document_name",
    "document": "document_name",
    "documentname": "document_name",
    "type": "document_type",
    "documenttype": "document_type",
    "framework": "regulation_framework",
    "regulation": "regulation_framework",
    "regulationframework": "regulation_framework",
    "control": "control_id",
    "controlid": "control_id",
    "control_desc": "control_description",
    "controldescription": "control_description",
    "description": "control_description",
    "control_details": "control_description",
    "agent_ids": "applicable_agent_ids",
    "applicableagentids": "applicable_agent_ids",
    "agents": "applicable_agent_ids",
    "owner": "assigned_owner",
    "assignedowner": "assigned_owner",
    "assigned_to": "assigned_owner",
    "last_reviewed": "last_reviewed_date",
    "lastrevieweddate": "last_reviewed_date",
    "next_review": "next_review_due_date",
    "nextreviewduedate": "next_review_due_date",
    "due_date": "next_review_due_date",
    "duedate": "next_review_due_date",
    "expiry": "expiration_date",
    "expiration": "expiration_date",
    "expirationdate": "expiration_date",
    "location": "evidence_location",
    "evidencelocation": "evidence_location",
    "hash": "evidence_hash",
    "evidencehash": "evidence_hash",
    "classification": "data_classification",
    "dataclassification": "data_classification",
    "retention": "retention_period",
    "retentionperiod": "retention_period",
    "legal_hold": "legal_hold_status",
    "legalholdstatus": "legal_hold_status",
    "approval": "approval_gate_required",
    "approvalgaterequired": "approval_gate_required",
    "risk": "risk_level",
    "risklevel": "risk_level",
}


def _normalize_key(value: str) -> str:
    value = str(value).strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def _clean_scalar(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _to_iso_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}", text):
        return text[:10]
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except Exception:
            pass
    return None


def _extract_pdf(file_bytes: bytes) -> Optional[str]:
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n".join(pages)
    except Exception:
        return None


def _extract_excel(file_bytes: bytes) -> Optional[List[Dict[str, Any]]]:
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        rows: List[Dict[str, Any]] = []
        try:
            for sheet in wb.worksheets:
                sheet_rows = list(sheet.iter_rows(values_only=True))
                if not sheet_rows:
                    continue
                headers = [str(h).strip() if h is not None else "" for h in sheet_rows[0]]
                for row_values in sheet_rows[1:]:
                    row_dict: Dict[str, Any] = {}
                    for idx, header in enumerate(headers):
                        if header:
                            row_dict[header] = row_values[idx] if idx < len(row_values) else ""
                    if any(str(v).strip() for v in row_dict.values()):
                        rows.append(row_dict)
        finally:
            wb.close()
        return rows or None
    except Exception:
        return None


def _try_csv_rows(text: str) -> Optional[List[Dict[str, Any]]]:
    if not text.strip():
        return None
    try:
        sample = text[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t|;")
        except Exception:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        rows: List[Dict[str, Any]] = []
        for row in reader:
            if any(v and str(v).strip() for v in row.values()):
                rows.append({k: _clean_scalar(v) for k, v in row.items()})
        if rows and reader.fieldnames:
            return rows
    except Exception:
        pass
    return None


def _try_json_rows(text: str) -> Optional[List[Dict[str, Any]]]:
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            return [data]
    except Exception:
        pass
    return None


def _try_kv_text(text: str) -> Optional[List[Dict[str, Any]]]:
    details: Dict[str, Any] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        raw_key, raw_value = line.split(":", 1)
        norm = _normalize_key(raw_key)
        if norm in DETAIL_FIELDS:
            details[norm] = _clean_scalar(raw_value)
        else:
            target = ALIASES.get(norm)
            if target in DETAIL_FIELDS:
                details[target] = _clean_scalar(raw_value)
    if any(details.values()):
        return [details]
    return None


def _row_to_details(row: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[str]]:
    details = {field: "" for field in DETAIL_FIELDS}
    raw_status = None
    for raw_key, raw_value in row.items():
        norm = _normalize_key(str(raw_key))
        if norm == "status":
            raw_status = _clean_scalar(raw_value)
            continue
        target = ALIASES.get(norm, norm)
        if target in DETAIL_FIELDS and not details.get(target):
            details[target] = _clean_scalar(raw_value)
    return details, raw_status


def _determine_status(details: Dict[str, Any], due_date: Optional[str]) -> str:
    legal_hold = str(details.get("legal_hold_status", "")).strip().lower()
    if legal_hold in {"true", "yes", "1", "active", "legal_hold", "hold"}:
        return "legal_hold"

    approval = str(details.get("approval_gate_required", "")).strip().lower()
    if approval in {"true", "yes", "1", "required"}:
        return "pending_approval"

    if due_date:
        try:
            due_dt = datetime.strptime(due_date, "%Y-%m-%d").date()
            if due_dt < date.today():
                return "expired"
        except Exception:
            pass

    risk = str(details.get("risk_level", "")).strip().lower()
    if risk in {"critical", "tampered"}:
        return "non_compliant"
    if risk in {"high", "flagged"}:
        return "flagged"

    if not details.get("document_id") and not details.get("control_id") and not details.get("document_name"):
        return "missing"
    return "valid"


def _pick_due_date(details: Dict[str, Any]) -> Optional[str]:
    for key in ("next_review_due_date", "expiration_date"):
        iso = _to_iso_date(details.get(key))
        if iso:
            return iso
    return None


def _make_record(details: Dict[str, Any], raw_status: Optional[str] = None) -> Dict[str, Any]:
    details = {field: _clean_scalar(details.get(field, "")) for field in DETAIL_FIELDS}
    title = (
        details.get("assigned_owner") or
        details.get("control_id") or
        details.get("document_name") or
        "Unknown Entity"
    )
    due_date = _pick_due_date(details)
    if raw_status and raw_status in ALLOWED_STATUSES:
        status = raw_status
    else:
        status = _determine_status(details, due_date)
    return {
        "title": title,
        "status": status,
        "details": details,
        "due_date": due_date,
    }


def _records_from_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    records = []
    for row in rows:
        details, raw_status = _row_to_details(row)
        records.append(_make_record(details, raw_status))
    return records


def _parse_json_records(content: str) -> List[Dict[str, Any]]:
    try:
        data = json.loads(content)
    except Exception:
        match = re.search(r"\[.*\]", content, re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except Exception:
            return []
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _call_deepseek_extraction(text: str) -> List[Dict[str, Any]]:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return []
    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )
        prompt = (
            "Return a JSON array of records. Each record must have these top-level keys exactly: "
            '"title", "status", "due_date", "details". '
            '"details" must contain these fields: ' +
            ", ".join(DETAIL_FIELDS) + ". "
            'The "title" field MUST be the primary entity the buyer tracks: employee name, vendor name, '
            'contract party, patient name, assigned owner, or control owner. NEVER use the document type or category as title. '
            'The "status" field must be exactly one of: missing, valid, expired, flagged, pending_approval, non_compliant, tampered, legal_hold, in_review. '
            '"due_date" must be an ISO-8601 date string or null. '
            "Do not include markdown. Return only JSON."
        )
        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": "You extract compliance evidence from unstructured documents into strict JSON records."},
                {"role": "user", "content": prompt + "\n\nDocument text:\n" + text[:12000]},
            ],
        )
        content = response.choices[0].message.content
        return _parse_json_records(content)
    except Exception:
        return []


def _records_from_llm_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    records = []
    for row in rows:
        details: Dict[str, Any] = {}
        raw_details = row.get("details", {})
        if isinstance(raw_details, dict):
            details.update(raw_details)
        for field in DETAIL_FIELDS:
            if row.get(field) is not None:
                details[field] = row.get(field)
        details = {field: _clean_scalar(details.get(field, "")) for field in DETAIL_FIELDS}
        raw_status = _clean_scalar(row.get("status")) if row.get("status") in ALLOWED_STATUSES else None
        record = _make_record(details, raw_status)
        if row.get("due_date"):
            iso = _to_iso_date(row.get("due_date"))
            if iso:
                record["due_date"] = iso
        if row.get("title"):
            record["title"] = _clean_scalar(row.get("title"))
        records.append(record)
    return records


def process_file(file_bytes: bytes) -> list[dict]:
    if not file_bytes:
        return []

    text: Optional[str] = None

    if file_bytes.startswith(b"%PDF"):
        text = _extract_pdf(file_bytes)

    if not text:
        excel_rows = _extract_excel(file_bytes)
        if excel_rows:
            return _records_from_rows(excel_rows)

    if not text:
        text = file_bytes.decode("utf-8", errors="ignore")

    if not text.strip():
        return []

    csv_rows = _try_csv_rows(text)
    if csv_rows:
        return _records_from_rows(csv_rows)

    json_rows = _try_json_rows(text)
    if json_rows:
        return _records_from_rows(json_rows)

    kv_rows = _try_kv_text(text)
    if kv_rows:
        return _records_from_rows(kv_rows)

    llm_rows = _call_deepseek_extraction(text)
    if llm_rows:
        return _records_from_llm_rows(llm_rows)

    details = {field: "" for field in DETAIL_FIELDS}
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    details["document_name"] = first_line[:200]
    return [_make_record(details)]
