import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function PPERequests() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['ppeRequests'],
    queryFn: () => axios.get('/api/ppe').then((res) => res.data),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">PPE Requests</h2>
      <div className="grid gap-4">
        {requests.map((request) => (
          <div key={request._id} className="p-4 bg-white rounded-lg shadow-md">
            <p>User ID: {request.userId}</p>
            <p>Items: {request.items.join(', ')}</p>
            <p className="text-sm text-gray-500">
              Requested: {new Date(request.requestedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
