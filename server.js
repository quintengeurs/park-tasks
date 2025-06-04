### File: index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Park Tasks</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <header>
        <h1>Park Tasks</h1>
        <nav>
            <a href="/">Home</a>
            <% if (user.role === 'Admin') { %>
                <a href="/admin">Admin</a>
            <% } %>
            <a href="/staff">Staff</a>
            <a href="/archive">Archive</a>
            <a href="/issues">Issues</a>
            <a href="/inspections">Inspections</a>
            <a href="/logout">Logout</a>
        </nav>
        <div class="header-buttons">
            <button id="raiseIssueBtn">Raise an Issue</button>
            <% if (user && ['Admin', 'Operations Manager', 'Area Manager North', 'Area Manager South', 'Head Gardeners', 'Keepers'].includes(user.role) && (user.role !== 'Keepers' || user.rospa_trained)) { %>
                <button id="recordInspectionBtn">Record Inspection/Induction</button>
            <% } %>
        </div>
    </header>
    <main>
        <h2>Welcome, <%= user.username %></h2>
        <div class="task-list">
            <% tasks.forEach(task => { %>
                <div class="task-card <%= task.urgency === 'High' ? 'high-urgency' : '' %>">
                    <h3><%= task.title %></h3>
                    <p><strong>Description:</strong> <%= task.description %></p>
                    <p><strong>Location:</strong> <%= task.location %></p>
                    <p><strong>Type:</strong> <%= task.type %></p>
                    <p><strong>Urgency:</strong> <%= task.urgency %></p>
                    <% if (task.image_path) { %>
                        <img src="<%= task.image_path %>" alt="Task Image" class="task-image">
                    <% } %>
                    <% if (task.schedule) { %>
                        <p><strong>Schedule:</strong> <%= task.schedule %></p>
                    <% } %>
                </div>
            <% }) %>
        </div>
    </main>
    <div id="issueModal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Raise an Issue</h2>
            <form id="issueForm" enctype="multipart/form-data" action="/issues" method="POST">
                <label>Title:</label>
                <input type="text" name="title" required>
                <label>Description:</label>
                <textarea name="description" required></textarea>
                <label>Location:</label>
                <input type="text" name="location" required>
                <label>Image:</label>
                <input type="file" name="image" accept="image/*">
                <label>Urgency:</label>
                <select name="urgency" required>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                </select>
                <button type="submit">Submit Issue</button>
            </form>
        </div>
    </div>
    <script src="/js/script.js"></script>
</body>
</html>
