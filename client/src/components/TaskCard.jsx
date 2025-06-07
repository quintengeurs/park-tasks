import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

export default function TaskCard({ task }) {
  const [image, setImage] = useState(null);
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('status', data.status);
      formData.append('completedNote', data.completedNote);
      return axios.patch(`/api/tasks/${task.id}`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  });

  const handleComplete = async () => {
    await mutation.mutateAsync({ status: 'pending', completedNote: note });
  };

  return (
    <div
      className={`p-4 bg-white rounded-lg shadow-md ${
        task.urgency === 'urgent' ? 'border-l-4 border-red-500' : ''
      }`}
    >
      <h3 className="text-lg font-semibold">{task.title}</h3>
      <p className="text-sm text-gray-500">{new Date(task.createdAt).toLocaleDateString()}</p>
      <p>{task.description}</p>
      {task.image && <img src={task.image} alt="Task" className="mt-2 w-full h-32 object-cover rounded" />}
      <p className="text-sm text-gray-500">Recurrence: {task.recurrence}</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files[0])}
        className="mt-2"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Completion note"
        className="w-full p-2 mt-2 border rounded"
      />
      <button
        onClick={handleComplete}
        className="mt-2 p-2 bg-green-500 text-white rounded"
      >
        Complete
      </button>
    </div>
  );
}