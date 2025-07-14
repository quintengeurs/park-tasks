import { createClient } from '@supabase/supabase-js';

  const supabase = createClient(
      'https://hpzcmwhdiffcfpteyiui.supabase.co', // Replace with your Supabase Project URL
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwemNtd2hkaWZmY2ZwdGV5aXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMzcyNTUsImV4cCI6MjA2NzkxMzI1NX0.x8uwDxLA5lJKDTo9kYqpJN7xLbjDbO_RrVQx2ZOiVdU' // Replace with your Supabase Anon Public Key
  );

  async function login() {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');

      try {
          const { data, error } = await supabase.auth.signInWithPassword({
              email: `${username}@example.com`, // Adjust for username-based auth
              password
          });
          if (error) {
              errorDiv.textContent = error.message;
              errorDiv.style.display = 'block';
              return;
          }
          localStorage.setItem('token', data.session.access_token);
          window.location.href = 'index.html';
      } catch (error) {
          errorDiv.textContent = 'An error occurred';
          errorDiv.style.display = 'block';
      }
  }
