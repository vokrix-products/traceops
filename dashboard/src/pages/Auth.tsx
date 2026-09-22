import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signIn, signUp } from '../lib/auth';
import { PRODUCT } from '../lib/product';
import { hasSupabase } from '../lib/supabase';

interface Props {
  onAuthed: () => void;
}

export function Auth({ onAuthed }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>(
    params.get('mode') === 'signup' ? 'signup' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError('');
    setNotice('');
  }, [mode]);

  async function submit() {
    if (busy) return;
    setError('');
    setNotice('');
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    if (mode === 'signup') {
      const { error: err, needsConfirm } = await signUp(email.trim(), password);
      setBusy(false);
      if (err) {
        setError(err);
        return;
      }
      if (needsConfirm) {
        setNotice('Check your inbox to confirm your account, then sign in.');
        setMode('signin');
        return;
      }
      onAuthed();
      navigate('/app');
    } else {
      const { user, error: err } = await signIn(email.trim(), password);
      setBusy(false);
      if (err || !user) {
        setError(err || 'Unable to sign in.');
        return;
      }
      onAuthed();
      navigate('/app');
    }
  }

  const hint =
    mode === 'signin'
      ? 'Access your compliance evidence workspace.'
      : 'Start with ' + PRODUCT.freeLimit + ' free Controls.';

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand">
          <span className="brand-mark">T</span>
          {PRODUCT.name}
        </div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
        <p className="hint">{hint}</p>

        {error ? <div className="banner err">{error}</div> : null}
        {notice ? <div className="banner ok">{notice}</div> : null}
        {!hasSupabase ? (
          <div className="banner info">
            Local mode - your data stays in this browser.
          </div>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 6 characters"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </label>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button onClick={() => setMode('signup')}>Sign up</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('signin')}>Sign in</button>
            </>
          )}
        </div>
        <div className="auth-switch">
          <button onClick={() => navigate('/')}>Back to overview</button>
        </div>
      </div>
    </div>
  );
}

export default Auth;
