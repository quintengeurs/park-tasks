import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import TasksPage from './pages/Mobile/TasksPage';
import LoginForm from './components/LoginForm';
import IssueReport from './components/IssueReport';
import PPEPopup from './components/PPEPopup';
import HSPopup from './components/HSPopup';
import AdminPage from './pages/AdminPage';
import StaffPage from './pages/StaffPage';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {user && (
        <nav className="bg-blue-500 text-white p-4">
          <div className="container mx-auto flex justify-between">
            <div className="space-x-4">
              <Link to="/tasks" className="hover:underline">Tasks</Link>
              {user.role === 'Admin' && (
                <Link to="/admin" className="hover:underline">Admin</Link>
              )}
              <Link to="/staff" className="hover:underline">Staff</Link>
              <Link to="/report-issue" className="hover:underline">Report Issue</Link>
            </div>
            <button
              onClick={logout}
              className="bg-red-500 px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route
          path="/tasks"
          element={user ? <TasksPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/report-issue"
          element={user ? <IssueReport /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin"
          element={user?.role === 'Admin' ? <AdminPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/staff"
          element={user ? <StaffPage /> : <Navigate to="/login" />}
        />
        <Route path="/ppe" element={<PPEPopup />} />
        <Route path="/hs" element={<HSPopup />} />
        <Route path="/" element={<Navigate to="/tasks" />} />
      </Routes>
    </div>
  );
}

export default App;
