import { useNavigate } from 'react-router-dom';
import { PRODUCT } from '../lib/product';

export function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand">
          <span className="brand-mark">T</span>
          {PRODUCT.name}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/auth')}>
            Sign in
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/auth?mode=signup')}>
            Get started
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="eyebrow">Compliance evidence traceability</div>
        <h1>
          Auditor-ready evidence from <em>every AI agent log</em> and control document.
        </h1>
        {PRODUCT.description}
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/auth?mode=signup')}>
            Start free — 3 Controls
          </button>
          <button className="btn" onClick={() => navigate('/auth')}>
            Sign in
          </button>
        </div>
      </header>

      <section className="grid-3">
        <div className="card feature">
          <h3>Tamper-proof controls</h3>
          
            Every record carries a full audit trail. Status transitions are
            logged with actor and timestamp so reviewers can prove what changed.
          
        </div>
        <div className="card feature">
          <h3>PII redaction &amp; holds</h3>
          
            Flag sensitive evidence, apply legal holds, and route risky items to
            a human approval gate before they can be marked valid.
          
        </div>
        <div className="card feature">
          <h3>Evidence you can trace</h3>
          
            Track each control by its assigned owner, due date, framework, and
            evidence location — across policies, spreadsheets and agent logs.
          
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <div className="eyebrow">How it works</div>
        <div className="card" style={{ padding: '8px 22px' }}>
          <div className="step-row">
            <div className="step-num">01</div>
            <div>
              <strong>Upload evidence</strong>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Drop CSV, JSON, or key/value control inventories. TraceOps
                normalizes them into compliance records.
              </div>
            </div>
          </div>
          <div className="step-row">
            <div className="step-num">02</div>
            <div>
              <strong>Resolve status</strong>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Each item is classified as valid, expired, flagged,
                non-compliant, tampered, on hold, or awaiting approval.
              </div>
            </div>
          </div>
          <div className="step-row" style={{ borderBottom: 'none' }}>
            <div className="step-num">03</div>
            <div>
              <strong>Prove compliance</strong>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Export the audit trail and due-date view your auditor asks for.
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>
          {PRODUCT.name} — {PRODUCT.id}
        </span>
        <span>Tamper-proof evidence · PII redaction · Human approval gates</span>
      </footer>
    </div>
  );
}

export default Landing;
