import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import MainLayout from '@/components/MainLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import PublishPage from '@/pages/PublishPage';
import AccountsPage from '@/pages/AccountsPage';
import CalendarPage from '@/pages/CalendarPage';
import TrafficLabPage from '@/pages/TrafficLabPage';
import AiAssistantPage from '@/pages/AiAssistantPage';
import SettingsPage from '@/pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/publish" element={<PublishPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/traffic" element={<TrafficLabPage />} />
                <Route path="/ai" element={<AiAssistantPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
