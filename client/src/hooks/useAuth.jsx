import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://park-services.onrender.com',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('Fetching /api/auth/me'); // Debug
      api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => {
          console.log('Auth/me response:', response.data); // Debug
          setUser(response.data);
        })
        .catch((error) => {
          console.error('Auth/me error:', error.response?.data || error.message); // Debug
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
