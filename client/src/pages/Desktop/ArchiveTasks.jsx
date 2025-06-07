import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function ArchiveTasks() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['archivedTasks'],
    queryFn: () => axios.get('/api/tasks?status=archived').then((res) => res.data),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Archived Tasks</h2>
      <div className="grid gap-4">
        {tasks.map((task) => (
          <div key={task._id} className="p-4 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <p>{task.description}</p>
            <p className="text-sm text-gray-500">
              Completed: {new Date(task.completedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
