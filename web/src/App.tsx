import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { ToastProvider } from './components/Toast';
import { NotificationsProvider } from './components/Notifications';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Upload from './pages/Upload';
import Jobs from './pages/Jobs';
import Revenue from './pages/Revenue';
import ManagerReport from './pages/ManagerReport';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import StudioChannel from './pages/studio/StudioChannel';
import ChannelOverview from './pages/studio/ChannelOverview';
import ChannelContent from './pages/studio/ChannelContent';
import ChannelAnalytics from './pages/studio/ChannelAnalytics';
import ChannelCommunity from './pages/studio/ChannelCommunity';

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
    return <div className="h-full grid place-items-center text-muted text-sm">Đang tải MS Hub…</div>;
  }

  if (!auth.user) {
    return (
      <ToastProvider>
        <Login needsSetup={auth.needsSetup} onDone={reload} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <NotificationsProvider>
      <Layout username={auth.user.username} onLogout={async () => { await api.post('/api/auth/logout'); reload(); }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/channels/:id" element={<StudioChannel />}>
            <Route index element={<ChannelOverview />} />
            <Route path="content" element={<ChannelContent />} />
            <Route path="analytics" element={<ChannelAnalytics />} />
            <Route path="community" element={<ChannelCommunity />} />
          </Route>
          <Route path="/managers/:id" element={<ManagerReport />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      </NotificationsProvider>
    </ToastProvider>
  );
}
