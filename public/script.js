async function checkAuth() {
    const response = await fetch('/api/auth/check', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (response.status !== 200) {
        window.location.href = 'login.html';
    }
}

async function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

async function fetchTasks() {
    const response = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const tasks = await response.json();
    const taskGrid = document.getElementById('taskGrid');
    taskGrid.innerHTML = '';
    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskCard.dataset.taskId = task.id;
        taskCard.innerHTML = `
            <img src="${task.image || 'https://via.placeholder.com/300x150'}" alt="Task Image">
            <h3>${task.title}</h3>
            <p>${task.description}</p>
            <div class="button-container">
                <button onclick="toggleTaskCompletion(this, ${task.id})">${task.completed ? 'Task Completed' : 'Complete Task'}</button>
                <button class="approve-button" onclick="approveTask(${task.id})">Approve</button>
            </div>
        `;
        taskGrid.appendChild(taskCard);
    });
}

async function fetchIssues() {
    const response = await fetch('/api/issues', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const issues = await response.json();
    const tableBody = document.getElementById('issuesTableBody');
    tableBody.innerHTML = '';
    issues.forEach(issue => {
        const urgencyClass = issue.urgency === 3 ? 'urgent-high' : issue.urgency === 2 ? 'urgent-medium' : 'urgent-low';
        const urgencyText = issue.urgency === 3 ? 'High' : issue.urgency === 2 ? 'Medium' : 'Low';
        const row = document.createElement('tr');
        row.dataset.issueId = issue.id;
        row.innerHTML = `
            <td>${issue.location}</td>
            <td>${issue.description}</td>
            <td data-timestamp="${issue.created_at}">${new Date(issue.created_at).toLocaleString()}</td>
            <td class="${urgencyClass}" data-urgency="${issue.urgency}">${urgencyText}</td>
            <td><a class="image-link" onclick="openImageModal('${issue.image || 'https://via.placeholder.com/300x150'}')">View Image</a></td>
            <td class="button-container">
                <button class="resolve-button" onclick="resolveIssue(${issue.id})">Resolve</button>
                <button class="task-button" onclick="raiseTaskFromIssue(${issue.id}, '${issue.location}', '${issue.description}', '${issue.image || 'https://via.placeholder.com/300x150'}')">Raise Task</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchArchivedTasks() {
    const response = await fetch('/api/tasks/archived', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const tasks = await response.json();
    const archiveGrid = document.getElementById('archiveGrid');
    archiveGrid.innerHTML = '';
    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.dataset.taskId = task.id;
        taskCard.innerHTML = `
            <img src="${task.image || 'https://via.placeholder.com/300x150'}" alt="Task Image">
            <h3>${task.title}</h3>
            <p>${task.description}</p>
        `;
        archiveGrid.appendChild(taskCard);
    });
    updateShowMoreButton();
}

async function fetchResolvedIssues() {
    const response = await fetch('/api/issues/resolved', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const issues = await response.json();
    const tableBody = document.getElementById('resolvedIssuesTableBody');
    tableBody.innerHTML = '';
    issues.forEach(issue => {
        const urgencyClass = issue.urgency === 3 ? 'urgent-high' : issue.urgency === 2 ? 'urgent-medium' : 'urgent-low';
        const urgencyText = issue.urgency === 3 ? 'High' : issue.urgency === 2 ? 'Medium' : 'Low';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${issue.location}</td>
            <td>${issue.description}</td>
            <td data-timestamp="${issue.created_at}">${new Date(issue.created_at).toLocaleString()}</td>
            <td class="${urgencyClass}" data-urgency="${issue.urgency}">${urgencyText}</td>
            <td><a class="image-link" onclick="openImageModal('${issue.image || 'https://via.placeholder.com/300x150'}')">View Image</a></td>
        `;
        tableBody.appendChild(row);
    });
}

function navigateToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const container = document.querySelector('.container');
    const sectionRect = section.getBoundingClientRect();
    const canvas = document.querySelector('.canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const scrollX = sectionRect.left - canvasRect.left - (viewportWidth - sectionRect.width) / 2;
    const scrollY = sectionRect.top - canvasRect.top;
    container.scrollTo({ top: scrollY, left: Math.max(0, scrollX), behavior: 'smooth' });
}

async function toggleTaskCompletion(button, taskId) {
    const taskCard = button.closest('.task-card');
    const completed = !button.classList.contains('completed');
    await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ completed })
    });
    button.classList.toggle('completed');
    button.textContent = completed ? 'Task Completed' : 'Complete Task';
    taskCard.classList.toggle('completed');
    updateShowMoreButton();
}

async function approveTask(taskId) {
    await fetch(`/api/tasks/${taskId}/archive`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    fetchTasks();
    fetchArchivedTasks();
}

function showMoreTasks() {
    const section3 = document.getElementById('section3');
    const currentHeight = parseInt(getComputedStyle(section3).minHeight);
    section3.style.minHeight = `${currentHeight + 1000}px`;
    updateShowMoreButton();
}

function updateShowMoreButton() {
    const archiveGrid = document.getElementById('archiveGrid');
    const showMoreButton = document.getElementById('showMoreButton');
    const taskCards = archiveGrid.querySelectorAll('.task-card');
    const section3 = document.getElementById('section3');
    const sectionHeight = section3.getBoundingClientRect().height;
    const gridHeight = archiveGrid.getBoundingClientRect().height;
    showMoreButton.style.display = taskCards.length > 12 || gridHeight > sectionHeight - 100 ? 'block' : 'none';
}

function openTaskForm() {
    document.getElementById('taskModal').style.display = 'flex';
}

function closeTaskForm() {
    document.getElementById('taskModal').style.display = 'none';
    document.getElementById('taskForm').reset();
}

function openIssueForm() {
    document.getElementById('issueModal').style.display = 'flex';
}

function closeIssueForm() {
    document.getElementById('issueModal').style.display = 'none';
    document.getElementById('issueForm').reset();
}

function openImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    modalImage.src = imageUrl;
    modal.style.display = 'flex';
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
}

async function handleTaskSubmit(event) {
    event.preventDefault();
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const image = document.getElementById('taskImage').value || null;
    await fetch('/api/tasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title, description, image })
    });
    fetchTasks();
    closeTaskForm();
}

async function handleIssueSubmit(event) {
    event.preventDefault();
    const location = document.getElementById('issueLocation').value;
    const description = document.getElementById('issueDescription').value;
    const urgency = document.getElementById('issueUrgency').value;
    const image = document.getElementById('issueImage').value || null;
    await fetch('/api/issues', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ location, description, urgency, image })
    });
    fetchIssues();
    closeIssueForm();
}

async function resolveIssue(issueId) {
    await fetch(`/api/issues/${issueId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    fetchIssues();
    fetchResolvedIssues();
}

function raiseTaskFromIssue(issueId, location, description, image) {
    const taskTitle = document.getElementById('taskTitle');
    const taskDescription = document.getElementById('taskDescription');
    const taskImage = document.getElementById('taskImage');
    taskTitle.value = location;
    taskDescription.value = description;
    taskImage.value = image;
    document.getElementById('taskModal').style.display = 'flex';
}

let sortDirection = {};
function sortTable(columnIndex) {
    const tableBody = document.getElementById('issuesTableBody');
    const rows = Array.from(tableBody.getElementsByTagName('tr'));
    const key = ['location', 'description', 'timestamp', 'urgency'][columnIndex];
    sortDirection[key] = !sortDirection[key] || sortDirection[key] === 'desc' ? 'asc' : 'desc';
    rows.sort((a, b) => {
        let aValue = columnIndex === 2 ? a.cells[columnIndex].getAttribute('data-timestamp') :
                     columnIndex === 3 ? a.cells[columnIndex].getAttribute('data-urgency') :
                     a.cells[columnIndex].textContent;
        let bValue = columnIndex === 2 ? b.cells[columnIndex].getAttribute('data-timestamp') :
                     columnIndex === 3 ? b.cells[columnIndex].getAttribute('data-urgency') :
                     b.cells[columnIndex].textContent;
        if (columnIndex === 2 || columnIndex === 3) {
            aValue = parseFloat(aValue) || aValue;
            bValue = parseFloat(bValue) || bValue;
        }
        return sortDirection[key] === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });
    tableBody.innerHTML = '';
    rows.forEach(row => tableBody.appendChild(row));
}

window.addEventListener('load', async () => {
    await checkAuth();
    navigateToSection('section1');
    fetchTasks();
    fetchIssues();
    fetchArchivedTasks();
    fetchResolvedIssues();
    document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);
    document.getElementById('issueForm').addEventListener('submit', handleIssueSubmit);
});