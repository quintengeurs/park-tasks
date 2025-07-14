# Task and Issue Management Website

A web application for managing tasks and issues with a large canvas interface, user authentication, and database storage.

## Setup

1. **Install Node.js**: Ensure Node.js is installed (version 14 or higher recommended).
2. **Clone Repository**: Clone this repository to your local machine.
3. **Install Dependencies**: Run `npm install` in the project root to install dependencies.
4. **Start Server**: Run `npm start` to start the server. The application will be available at `http://localhost:3000`.
5. **Default User**: Use `username: admin`, `password: admin123` to log in.

## Project Structure

- `public/`: Frontend files (HTML, CSS, JS)
- `server/`: Backend files (Node.js, Express, SQLite)
- `server/routes/`: API route handlers

## Features

- User authentication with JWT
- Task creation, completion, and archiving
- Issue creation, resolution, and task creation from issues
- Mobile-responsive UI
- SQLite database for data persistence

## Future Enhancements

- User roles (admin, user, etc.)
- File uploads for images
- Notifications for task/issue updates
- Advanced sorting and filtering