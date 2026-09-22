# TraceOps

TraceOps is a compliance evidence traceability product. It ingests uploaded
policy, audit, and control-evidence files and turns them into normalized
compliance records that a dashboard can render.

## Product Archetype

Evidence-tracking compliance tracker. The buyer uploads documents (policy PDFs,
control spreadsheets, audit exports, CSV inventories) and expects the system to
tell them, per tracked entity, whether the supporting evidence exists, is still
valid, is expired, is flagged, or is blocked behind an approval gate or legal hold.

The primary tracked entity is the owner of the evidence, not the document itself.
For a compliance buyer this means the `title` of a record should be the
`assigned_owner` when present (falling back to `control_id`, then `document_name`).

## Repository Contents

| File | Purpose |
|------|---------|
| `processor.py` | Core extraction module. Defines `process_file(file_bytes: bytes) -> list[dict]`. Handles PDF, Excel, CSV, JSON, key/value text, and a plain-text fallback. Optionally calls DeepSeek `deepseek-v4-flash` when `DEEPSEEK_API_KEY` is set. |
| `run_demo.py` | Zero-argument demo. Feeds a hardcoded realistic CSV byte string through `process_file` and prints one extracted record. Exits 0 in under 10 seconds. |
| `run_tests.py` | Zero-argument test runner. Asserts record shape, top-level `due_date`, status whitelist, and required detail fields. |
| `requirements.txt` | Python dependencies: `openai`, `requests`, `pdfplumber`, `openpyxl`. |

## Extraction Behavior

`process_file(file_bytes: bytes) -> list[dict]` accepts raw file bytes and
returns a list of records.

Pipeline order:

1. If bytes start with `%PDF`, extract text with `pdfplumber`.
2. Otherwise, try Excel via `openpyxl` (first row = headers).
3. Fallback: decode bytes as UTF-8 text and try CSV sniffing, then JSON, then
   `key: value` line parsing.
4. If unstructured text remains and `DEEPSEEK_API_KEY` is present, call
   `deepseek-v4-flash` and parse the JSON array it returns.
5. Final fallback: emit a single record from the first non-empty line.

## Record Schema

Each record has exactly these top-level keys:

| Key | Type | Description |
|-----|------|-------------|
| `title` | `str` | Primary entity the buyer tracks. Resolved as `assigned_owner` → `control_id` → `document_name` → `"Unknown Entity"`. |
| `status` | `str` | Whitelisted status (see below). |
| `details` | `dict` | All normalized compliance detail fields. |
| `due_date` | `str \| None` | ISO-8601 date, derived from `next_review_due_date` then `expiration_date`. |

Status whitelist:

`missing`, `valid`, `expired`, `flagged`, `pending_approval`, `non_compliant`,
`tampered`, `legal_hold`, `in_review`.

`details` always contains these fields (empty string when absent):

`document_id`, `document_name`, `document_type`, `regulation_framework`,
`control_id`, `control_description`, `applicable_agent_ids`, `assigned_owner`,
`last_reviewed_date`, `next_review_due_date`, `expiration_date`,
`evidence_location`, `evidence_hash`, `data_classification`, `retention_period`,
`legal_hold_status`, `approval_gate_required`, `risk_level`.

Note: `due_date` is top-level only and is never duplicated inside `details`.

## Status Resolution

1. `legal_hold_status` truthy → `legal_hold`
2. `approval_gate_required` truthy → `pending_approval`
3. `due_date` in the past → `expired`
4. `risk_level` critical/tampered → `non_compliant`; high/flagged → `flagged`
5. No document identifiers at all → `missing`
6. Otherwise → `valid`

An explicitly supplied status that is in the whitelist always wins.

## What the Poller Expects as Input

The Railway poller uploads raw file bytes to this processor. Input is expected to
be one of:

- A binary PDF (`%PDF` magic bytes)
- A binary Excel workbook (`.xlsx`, parsed via `openpyxl`)
- UTF-8 CSV text with a header row
- UTF-8 JSON (list of objects, or a single object)
- UTF-8 `key: value` text, one field per line
- Any other UTF-8 text, passed to DeepSeek when `DEEPSEEK_API_KEY` is set

Output on stdout is a JSON-serializable list of records matching the schema above.

## Usage

```bash
python3 run_demo.py
python3 run_tests.py
```

## Environment

- `DEEPSEEK_API_KEY` — optional. Enables LLM extraction fallback via `deepseek-v4-flash`.
