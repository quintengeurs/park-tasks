import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import LoginForm from './components/LoginForm';
import TasksPage from './pages/Mobile/TasksPage';
import IssueReport from './pages/Mobile/IssueReport';
import StaffManagement from './pages/Desktop/StaffManagement';
import PendingTasks from './pages/Desktop/PendingTasks';
import ArchiveTasks from './pages/Desktop/ArchiveTasks';
import PPERequests from './pages/Desktop/PPERequests';
import PPEPopup from './components/PPEPopup';
import HSPopup from './components/HSPopup';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPPEPopup, setShowPPEPopup] = useState(true);
  const [showHSPopup, setShowHSPopup] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        setUser(res.data);
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('token');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {user ? (
        <>
          <PPEPopup isOpen={showPPEPopup} onClose={() => setShowPPEPopup(false)} />
          {showPPEPopup || <HSPopup isOpen={showHSPopup} onClose={() => setShowHSPopup(false)} />}
          <Routes>
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/issues" element={<IssueReport />} />
            <Route path="/staff" element={<StaffManagement />} />
            <Route path="/pending" element={<PendingTasks />} />
            <Route path="/archive" element={<ArchiveTasks />} />
            <Route path="/ppe-requests" element={<PPERequests />} />
            <Route path="*" element={<Navigate to="/tasks" />} />
          </Routes>
        </>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginForm setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </div>
  );
}

export default App;