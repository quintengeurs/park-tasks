import React from 'react';
import TaskList from './components/TaskList';
import StaffManagement from './components/StaffManagement';
import './index.css';

const App = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Park Tasks</h1>
      <TaskList />
      <StaffManagement />
    </div>
  );
};
export default App;
