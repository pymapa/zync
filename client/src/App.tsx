import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { ErrorBoundary } from './providers/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard } from './router/guards/AuthGuard';
import { GuestGuard } from './router/guards/GuestGuard';
import './App.css';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Callback = lazy(() => import('./pages/Callback'));
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'));

function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route
                  path="/login"
                  element={
                    <GuestGuard>
                      <Login />
                    </GuestGuard>
                  }
                />
                <Route path="/callback" element={<Callback />} />
                <Route
                  path="/dashboard"
                  element={
                    <AuthGuard>
                      <Dashboard />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/activity/:id"
                  element={
                    <AuthGuard>
                      <ActivityDetail />
                    </AuthGuard>
                  }
                />
              </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
