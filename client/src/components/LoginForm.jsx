import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const api = axios.create({
  baseURL: 'https://park-tasks.onrender.com',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const mutation = useMutation({
    mutationFn: async ({ email, password }) => {
      console.log('Sending login request to: https://park-tasks.onrender.com/api/auth/login', { email }); // Debug
      const response = await api.post('/api/auth/login', { email, password });
      console.log('Raw login response:', { status: response.status, headers: response.headers, data: response.data }); // Debug
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Login response:', data); // Debug
      if (data.token && data.user) {
        localStorage.setItem('token', data.token);
        login(data.user);
        console.log('Token stored:', localStorage.getItem('token')); // Debug
        console.log('User logged in:', data.user); // Debug
        setTimeout(() => navigate('/tasks'), 100);
      } else {
        console.error('Invalid login response:', data);
        setError('Invalid server response');
      }
    },
    onError: (err) => {
      console.error('Login error:', err.response?.data || err.message); // Debug
      setError(err.response?.data?.error || 'Login failed');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ email, password });
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded"
          disabled={mutation.isLoading}
        >
          {mutation.isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
