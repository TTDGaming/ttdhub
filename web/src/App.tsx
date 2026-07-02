import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import ChannelDetail from './pages/ChannelDetail';
import Upload from './pages/Upload';
import Jobs from './pages/Jobs';
import Settings from './pages/Settings';

interface AuthState {
  needsSetup: boolean;
  user: { username: string } | null;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  const reload = useCallback(async () => {
    const state = await api.get<AuthState>('/api/auth/state');
    setAuth(state);
  }, []);

  useEffect(() => {
    reload().catch(() => setAuth({ needsSetup: false, user: null }));
  }, [reload]);

  if (!auth) {
    return (
      <div className="h-full grid place-items-center text-muted text-sm">Đang tải MS Hub…</div>
    );
  }

  if (!auth.user) {
    return <Login needsSetup={auth.needsSetup} onDone={reload} />;
  }

  return (
    <Layout username={auth.user.username} onLogout={async () => { await api.post('/api/auth/logout'); reload(); }}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/channels/:id" element={<ChannelDetail />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
