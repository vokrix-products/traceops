from processor import process_file, ALLOWED_STATUSES, DETAIL_FIELDS

CSV_BYTES = (
    "document_id,document_name,document_type,regulation_framework,control_id,control_description,"
    "applicable_agent_ids,assigned_owner,last_reviewed_date,next_review_due_date,expiration_date,"
    "evidence_location,evidence_hash,data_classification,retention_period,legal_hold_status,"
    "approval_gate_required,risk_level\n"
    "DOC-1001,Access Control Policy,Policy,SOC2,SOC2-AC-01,Role-based access enforced for AI agents,"
    "agent-7;agent-9,Alice Chen,2025-01-15,2025-04-15,2026-01-15,"
    "s3://evidence-bucket/soc2-ac-01.pdf,sha256:abc123,confidential,7 years,false,true,medium\n"
).encode("utf-8")


def test_process_file_contract() -> None:
    records = process_file(CSV_BYTES)
    assert isinstance(records, list), "process_file must return a list"
    assert records, "expected at least one record"

    for record in records:
        assert set(record.keys()) == {"title", "status", "details", "due_date"}
        assert record["status"] in ALLOWED_STATUSES
        assert isinstance(record["details"], dict)
        assert "due_date" not in record["details"], "due_date must be top-level only"
        for field in DETAIL_FIELDS:
            assert field in record["details"]


def test_empty_file_returns_empty_list() -> None:
    assert process_file(b"") == []


if __name__ == "__main__":
    test_process_file_contract()
    test_empty_file_returns_empty_list()
    print("all tests passed")
