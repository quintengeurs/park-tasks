import React from 'react';
import axios from 'axios';

const TaskCard = ({ task }) => {
  const handleAction = async (action) => {
    if (action === 'raise_issue') {
      await axios.post('/api/issues', { title: task.title, description: task.description, image_url: task.image_url, status: 'open' });
    }
  };

  return (
    <div className={`card ${task.urgency ? 'urgent' : ''}`}>
      <h3 className="font-bold">{task.title}</h3>
      <p>{task.description}</p>
      {task.image_url && <img src={task.image_url} alt="Task" className="max-w-full h-auto" />}
      <div className="flex space-x-2 desktop-only">
        <button className="action-button" onClick={() => handleAction('raise_issue')}>
          Raise Issue
        </button>
        <button className="action-button">Edit</button>
        <button className="action-button">Delete</button>
      </div>
    </div>
  );
};
export default TaskCard;
