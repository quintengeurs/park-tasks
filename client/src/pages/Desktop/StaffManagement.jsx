import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function StaffManagement() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => axios.get('/api/users').then((res) => res.data),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Staff Management</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Privileges</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.uid} className="border-b">
              <td className="p-2">{user.name}</td>
              <td className="p-2">{user.email}</td>
              <td className="p-2">{user.role}</td>
              <td className="p-2">{user.privileges.join(', ')}</td>
              <td className="p-2">
                <button className="text-blue-500">Edit</button>
                <button className="text-red-500 ml-2">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
