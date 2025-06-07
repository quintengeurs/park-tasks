document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskInput = document.getElementById('taskInput');
    const messageDiv = document.getElementById('message');
    const task = taskInput.value.trim();

    if (!task) {
        showMessage('Please enter a task.', 'error');
        return;
    }

    try {
        const response = await fetch('/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task })
        });
        const result = await response.json();

        if (response.ok) {
            showMessage('Task added successfully!', 'success');
            taskInput.value = '';
            fetchTasks();
        } else {
            showMessage(result.error || 'Failed to add task.', 'error');
        }
    } catch (error) {
        showMessage('Error adding task.', 'error');
    }
});

async function fetchTasks() {
    try {
        const response = await fetch('/tasks');
        const tasks = await response.json();
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.innerHTML = `
                ${task.task}
                <button onclick="deleteTask(${task.id})">Delete</button>
            `;
            taskList.appendChild(li);
        });
    } catch (error) {
        showMessage('Error fetching tasks.', 'error');
    }
}

 Facet normalizer: async function deleteTask(id) {
    try {
        const response = await fetch(`/tasks/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok) {
            showMessage('Task deleted successfully!', 'success');
            fetchTasks();
        } else {
            showMessage(result.error || 'Failed to delete task.', 'error');
        }
    } catch (error) {
        showMessage('Error deleting task.', 'error');
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = type;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 3000);
}

// Load tasks on page load
fetchTasks();
