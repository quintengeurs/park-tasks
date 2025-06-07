import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

export default function IssueReport() {
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      formData.append('description', data.description);
      formData.append('image', image);
      formData.append('userId', 'current-user'); // Replace with actual user ID
      return axios.post('/api/issues', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  });

  const handleSubmit = async () => {
    await mutation.mutateAsync({ description });
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Report Issue</h2>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the issue"
        className="w-full p-2 border rounded"
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files[0])}
        className="mt-2"
      />
      <button
        onClick={handleSubmit}
        className="mt-4 p-2 bg-blue-500 text-white rounded"
      >
        Submit Issue
      </button>
    </div>
  );
}