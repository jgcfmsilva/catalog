import { useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import Login from './Login.jsx';
import Library from './Library.jsx';
import CursorGlow from './CursorGlow.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!getToken()) return setUser(null);
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  let view;
  if (user === undefined) view = <div className="boot"><span className="spinner" /></div>;
  else if (!user) view = <Login onLogin={(u, token) => { setToken(token); setUser(u); }} />;
  else view = <Library user={user} onLogout={() => { setToken(null); setUser(null); }} />;

  return (
    <>
      <CursorGlow />
      {view}
    </>
  );
}
