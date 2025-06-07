import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

export default function PendingTasks() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['pendingTasks'],
    queryFn: () => axios.get('/api/tasks?status=pending').then((res) => res.data),
  });

  const mutation = useMutation({
    mutationFn: (id) => axios.patch(`/api/tasks/${id}`, { status: 'archived' }),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Pending Tasks</h2>
      <div className="grid gap-4">
        {tasks.map((task) => (
          <div key={task._id} className="p-4 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <p>{task.description}</p>
            {task.completedImage && (
              <img
                src={task.completedImage}
                alt="Completed"
                className="w-full h-32 object-cover rounded"
              />
            )}
            <p className="text-sm text-gray-500">Note: {task.completedNote}</p>
            <button
              onClick={() => mutation.mutate(task._id)}
              className="mt-2 p-2 bg-green-500 text-white rounded"
            >
              Approve & Archive
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
