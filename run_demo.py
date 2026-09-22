from processor import process_file, ALLOWED_STATUSES, DETAIL_FIELDS

DEMO_CSV = (
    "document_id,document_name,document_type,regulation_framework,control_id,control_description,"
    "applicable_agent_ids,assigned_owner,last_reviewed_date,next_review_due_date,expiration_date,"
    "evidence_location,evidence_hash,data_classification,retention_period,legal_hold_status,"
    "approval_gate_required,risk_level\n"
    "DOC-1001,Access Control Policy,Policy,SOC2,SOC2-AC-01,Role-based access enforced for AI agents,"
    "agent-7;agent-9,Alice Chen,2025-01-15,2025-04-15,2026-01-15,"
    "s3://evidence-bucket/soc2-ac-01.pdf,sha256:abc123,confidential,7 years,false,true,medium\n"
).encode("utf-8")


def main() -> None:
    results = process_file(DEMO_CSV)
    assert isinstance(results, list), "top-level result must be a list"
    assert results, "demo CSV must produce at least one record"

    record = results[0]
    assert record["title"] == "Alice Chen"
    assert record["status"] in ALLOWED_STATUSES
    assert record["due_date"] == "2025-04-15"
    assert record["details"]["control_id"] == "SOC2-AC-01"
    for field in DETAIL_FIELDS:
        assert field in record["details"]

    print("demo ok")
    print(record)


if __name__ == "__main__":
    main()
