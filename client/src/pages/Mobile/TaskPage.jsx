import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import TaskCard from '../../components/TaskCard';

export default function TasksPage() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => axios.get('/api/tasks').then((res) => res.data),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Your Tasks</h2>
      <div className="grid gap-4">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} />
        ))}
      </div>
    </div>
  );
}
