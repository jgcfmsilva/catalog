import { useState } from 'react';
import { api } from './api.js';
import { Logo } from './Logo.jsx';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user, token } = await api.login(username.trim(), password);
      onLogin(user, token);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="panel login-card" onSubmit={submit}>
        <Logo big />
        <label>
          <span className="hud">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>
          <span className="hud">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Authenticating…' : 'Enter'}</button>
      </form>
    </main>
  );
}
