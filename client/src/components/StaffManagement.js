import React, { useState } from 'react';
import axios from 'axios';

const StaffManagement = () => {
  const [formData, setFormData] = useState({
    name: '',
    team: '',
    job_role: '',
    account_features: { can_create_tasks: false, can_edit_issues: false },
    page_visibility: { tasks: true, issues: true },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('/api/staff', formData);
  };

  return (
    <form onSubmit={handleSubmit} className="card mt-4">
      <input
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="border p-2 mb-2 w-full"
      />
      <input
        type="text"
        placeholder="Team"
        value={formData.team}
        onChange={(e) => setFormData({ ...formData, team: e.target.value })}
        className="border p-2 mb-2 w-full"
      />
      <input
        type="text"
        placeholder="Job Role"
        value={formData.job_role}
        onChange={(e) => setFormData({ ...formData, job_role: e.target.value })}
        className="border p-2 mb-2 w-full"
      />
      <div className="mb-2">
        <label className="mr-4">
          <input
            type="radio"
            name="can_create_tasks"
            checked={formData.account_features.can_create_tasks}
            onChange={() =>
              setFormData({
                ...formData,
                account_features: { ...formData.account_features, can_create_tasks: true },
              })
            }
          />
          Can Create Tasks
        </label>
        <label>
          <input
            type="radio"
            name="can_edit_issues"
            checked={formData.account_features.can_edit_issues}
            onChange={() =>
              setFormData({
                ...formData,
                account_features: { ...formData.account_features, can_edit_issues: true },
              })
            }
          />
          Can Edit Issues
        </label>
      </div>
      <button type="submit" className="action-button">
        Submit
      </button>
    </form>
  );
};
export default StaffManagement;
