import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';
import LoginForm from './components/LoginForm';
import TasksPage from './pages/Mobile/TasksPage';
import IssueReport from './pages/Mobile/IssueReport';
import StaffManagement from './pages/Desktop/StaffManagement';
import PendingTasks from './pages/Desktop/PendingTasks';
import ArchiveTasks from './pages/Desktop/ArchiveTasks';
import PPERequests from './pages/Desktop/PPERequests';
import PPEPopup from './components/PPEPopup';
import HSPopup from './components/HSPopup';
import { useState } from 'react';

function App() {
  const [user, loading] = useAuthState(auth);
  const [showPPEPopup, setShowPPEPopup] = useState(true);
  const [showHSPopup, setShowHSPopup] = useState(true);

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
          <Route path="/login" element={<LoginForm />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </div>
  );
}

export default App;
