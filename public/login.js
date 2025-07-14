import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://your-project-id.supabase.co', // Your Supabase Project URL
    'your-anon-public-key' // Your Supabase Anon Public Key
);

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${username}@example.com`, // Adjust if needed
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
