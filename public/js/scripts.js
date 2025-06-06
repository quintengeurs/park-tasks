document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const tasksContainer = document.getElementById('tasks');
    const adminTasksContainer = document.getElementById('admin-tasks');
    const archiveTasksContainer = document.getElementById('archive-tasks');
    const issuesContainer = document.getElementById('issues');
    const dueTodayTaskForm = document.getElementById('due-today-task-form');
    const scheduledTaskForm = document.getElementById('scheduled-task-form');
    const editTaskForm = document.getElementById('edit-task-form');
    const editTaskModal = document.getElementById('edit-task-modal');
    const closeEditModal = document.getElementById('close-edit-modal');
    const usersList = document.getElementById('users-list');
    const userForm = document.getElementById('user-form');
    const userModal = document.getElementById('user-modal');
    const addUserBtn = document.getElementById('add-user-btn');
    const closeModal = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    const loginForm = document.getElementById('login-form');
    const issueModal = document.getElementById('issue-modal');
    const closeIssueModal = document.getElementById('close-issue-modal');
    const issueForm = document.getElementById('issue-form');
    const raiseIssueBtn = document.getElementById('raise-issue-btn');
    const completeTaskModal = document.getElementById('complete-task-modal');
    const closeCompleteModal = document.getElementById('close-complete-modal');
    const completeTaskForm = document.getElementById('complete-task-form');

    // Toast notification
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Login page
    if (loginForm && window.location.pathname === '/login') {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.querySelector('#username').value;
            const password = loginForm.querySelector('#password').value;
            const errorElement = document.getElementById('login-error');
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    window.location.href = '/';
                } else {
                    errorElement.style.display = 'block';
                    errorElement.textContent = data.message || 'Invalid credentials';
                }
            } catch (err) {
                console.error('Login error:', err);
                errorElement.style.display = 'block';
                errorElement.textContent = 'Server error';
            }
        });
    }

    // Navbar setup
    if (navbar) {
        fetch('/api/current-user')
            .then(res => res.json())
            .then(user => {
                if (user) {
                    const permissions = user.permissions || ['tasks'];
                    navbar.innerHTML = `
                        ${permissions.includes('tasks') ? '<a href="/">Tasks</a>' : ''}
                        ${permissions.includes('admin') ? '<a href="/admin">Admin</a>' : ''}
                        ${permissions.includes('archive') ? '<a href="/archive">Archive</a>' : ''}
                        ${permissions.includes('staff') ? '<a href="/staff">Staff Management</a>' : ''}
                        ${permissions.includes('issues') ? '<a href="/issues">Issues</a>' : ''}
                        <button id="logout-btn">Logout</button>
                    `;
                    const logoutBtn = document.getElementById('logout-btn');
                    logoutBtn.addEventListener('click', async () => {
                        try {
                            const res = await fetch('/api/logout', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include'
                            });
                            const data = await res.json();
                            if (data.success) {
                                window.location.href = '/login';
                            } else {
                                console.error('Logout failed:', data.message);
                            }
                        } catch (err) {
                            console.error('Logout error:', err);
                        }
                    });
                } else {
                    window.location.href = '/login';
                }
            })
            .catch(err => {
                console.error('Navbar fetch error:', err);
                window.location.href = '/login';
            });
    }

    // Determine current season
    function getCurrentSeason() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    // WebSocket setup
    let ws;
    function connectWebSocket() {
        ws = new WebSocket(`wss://${window.location.host}/`);
        ws.onopen = () => console.log('WebSocket connected');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data);
            if ((data.type === 'new_task' || data.type === 'updated_task') && tasksContainer && window.location.pathname === '/') {
                loadTasks(document.querySelector('.filter-btn.active')?.dataset.type || 'maintenance');
            }
            if ((data.type === 'new_task' || data.type === 'updated_task') && adminTasksContainer && window.location.pathname === '/admin') {
                loadAdminTasks();
            }
            if ((data.type === 'new_task' || data.type === 'updated_task') && archiveTasksContainer && window.location.pathname === '/archive') {
                loadArchiveTasks();
            }
            if ((data.type === 'new_issue' || data.type === 'updated_issue') && issuesContainer && window.location.pathname === '/issues') {
                loadIssues();
            }
        };
        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(connectWebSocket, 5000);
        };
        ws.onerror = (err) => console.error('WebSocket error:', err);
    }
    if (tasksContainer || adminTasksContainer || archiveTasksContainer || issuesContainer) {
        connectWebSocket();
    }

    // Admin page
    if ((dueTodayTaskForm || scheduledTaskForm) && adminTasksContainer && window.location.pathname === '/admin') {
        const dueTodayAllocatedTo = document.getElementById('due-today-allocated-to');
        const scheduledAllocatedTo = document.getElementById('allocated-to');
        const editAllocatedToSelect = document.getElementById('edit-allocated-to');
        fetch('/api/users')
            .then(res => res.json())
            .then(users => {
                const options = `<option value="">None</option>${users.map(user => `<option value="${user.username}">${user.username}</option>`).join('')}`;
                dueTodayAllocatedTo.innerHTML = options;
                scheduledAllocatedTo.innerHTML = options;
                editAllocatedToSelect.innerHTML = options;
            })
            .catch(err => console.error('Fetch users error:', err));

        const seasonButtons = document.querySelectorAll('.scheduled-task-form .season-btn');
        const seasonInput = document.getElementById('season-input');
        seasonButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                seasonButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                seasonInput.value = btn.dataset.season;
            });
        });

        const editSeasonButtons = editTaskForm.querySelectorAll('.season-btn');
        const editSeasonInput = document.getElementById('edit-season-input');
        editSeasonButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                editSeasonButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                editSeasonInput.value = btn.dataset.season;
            });
        });

        if (dueTodayTaskForm) {
            dueTodayTaskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(dueTodayTaskForm);
                const today = new Date().toISOString().split('T')[0];
                formData.append('due_date', today);
                formData.append('season', 'all');
                formData.append('recurrence', '');
                try {
                    const res = await fetch('/api/tasks', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    if (data.success) {
                        dueTodayTaskForm.reset();
                        document.getElementById('due-today-form-error').style.display = 'none';
                        showToast('Task created successfully!');
                        loadAdminTasks();
                    } else {
                        document.getElementById('due-today-form-error').style.display = 'block';
                        document.getElementById('due-today-form-error').textContent = data.message || 'Failed to add task';
                    }
                } catch (err) {
                    console.error('Due today task creation error:', err);
                    document.getElementById('due-today-form-error').style.display = 'block';
                    document.getElementById('due-today-form-error').textContent = 'Server error';
                }
            });
        }

        if (scheduledTaskForm) {
            scheduledTaskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const dueDate = document.getElementById('due_date').value;
                const season = seasonInput.value;
                if (!dueDate && (!season || season === 'all')) {
                    document.getElementById('form-error').style.display = 'block';
                    document.getElementById('form-error').textContent = 'Either a due date or a specific season is required';
                    return;
                }
                const formData = new FormData(scheduledTaskForm);
                try {
                    const res = await fetch('/api/tasks', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    if (data.success) {
                        scheduledTaskForm.reset();
                        seasonButtons.forEach(b => b.classList.remove('active'));
                        seasonInput.value = 'all';
                        document.getElementById('form-error').style.display = 'none';
                        showToast('Task created successfully!');
                        loadAdminTasks();
                    } else {
                        document.getElementById('form-error').style.display = 'block';
                        document.getElementById('form-error').textContent = data.message || 'Failed to add task';
                    }
                } catch (err) {
                    console.error('Scheduled task creation error:', err);
                    document.getElementById('form-error').style.display = 'block';
                    document.getElementById('form-error').textContent = 'Server error';
                }
            });
        }

        editTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = editTaskForm.querySelector('input[name="id"]').value;
            const dueDate = document.getElementById('edit-due_date').value;
            const season = editSeasonInput.value;
            if (!dueDate && (!season || season === 'all')) {
                document.getElementById('edit-form-error').style.display = 'block';
                document.getElementById('edit-form-error').textContent = 'Either a due date or a specific season is required';
                return;
            }
            const formData = new FormData(editTaskForm);
            formData.append('existing_image', editTaskForm.dataset.existingImage || '');
            try {
                const res = await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    editTaskModal.style.display = 'none';
                    editTaskForm.reset();
                    editSeasonButtons.forEach(b => b.classList.remove('active'));
                    editSeasonInput.value = 'all';
                    document.getElementById('edit-form-error').style.display = 'none';
                    showToast('Task updated successfully!');
                    loadAdminTasks();
                } else {
                    document.getElementById('edit-form-error').style.display = 'block';
                    document.getElementById('edit-form-error').textContent = data.message || 'Failed to update task';
                }
            } catch (err) {
                console.error('Task update error:', err);
                document.getElementById('edit-form-error').style.display = 'block';
                document.getElementById('edit-form-error').textContent = 'Server error';
            }
        });

        closeEditModal.addEventListener('click', () => {
            editTaskModal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === editTaskModal) {
                editTaskModal.style.display = 'none';
            }
        });

        function loadAdminTasks() {
            fetch('/api/tasks')
                .then(res => res.json())
                .then(tasks => {
                    const today = new Date().toISOString().split('T')[0];
                    const dueTodayContainer = document.querySelector('#due-today .tasks');
                    const completedContainer = document.querySelector('#completed .tasks');
                    const scheduledContainer = document.querySelector('#scheduled .tasks');

                    dueTodayContainer.innerHTML = '';
                    completedContainer.innerHTML = '';
                    scheduledContainer.innerHTML = '';

                    const dueTodayTasks = tasks.filter(task => !task.archived && !task.completed && task.due_date === today);
                    const completedTasks = tasks.filter(task => !task.archived && task.completed);
                    const scheduledTasks = tasks.filter(task => !task.archived && task.recurrence);

                    dueTodayTasks.forEach(task => {
                        const card = createAdminTaskCard(task, true);
                        dueTodayContainer.appendChild(card);
                    });

                    completedTasks.forEach(task => {
                        const card = createAdminTaskCard(task, false);
                        completedContainer.appendChild(card);
                    });

                    scheduledTasks.forEach(task => {
                        const card = createAdminTaskCard(task, false, true);
                        scheduledContainer.appendChild(card);
                    });

                    addAdminTaskEventListeners();
                })
                .catch(err => console.error('Admin tasks fetch error:', err));
        }

        function createAdminTaskCard(task, showCompleteButton = false, showEditButton = false) {
            const isUrgent = task.urgency === 'urgent';
            const card = document.createElement('div');
            card.className = `admin-task-card ${task.completed ? 'completed' : ''} ${isUrgent ? 'urgent' : ''}`;
            card.dataset.id = task.id;
            card.innerHTML = `
                <div class="task-info">
                    <h3>${task.title}</h3>
                    <p>Type: ${task.type}</p>
                    <p>Due: ${task.due_date || 'None'}</p>
                    <p>Urgency: ${task.urgency}</p>
                    <p>Allocated To: ${task.allocated_to || 'None'}</p>
                    <p>Season: ${task.season || 'All'}</p>
                    ${task.recurrence ? `<p>Recurrence: ${task.recurrence}</p>` : ''}
                    ${task.completion_note ? `<p>Completion Note: ${task.completion_note}</p>` : ''}
                    ${task.completion_image ? `<img src="${task.completion_image}" alt="Completion Image" class="completion-image" data-src="${task.completion_image}">` : ''}
                </div>
                <div class="task-actions">
                    ${task.completed ? `<p class="completed-note">Task Completed</p>` : ''}
                    ${showCompleteButton && !task.completed ? `<button class="complete-btn">Complete</button>` : ''}
                    ${showEditButton ? `<button class="edit-btn">Edit</button>` : ''}
                    <button class="archive-btn">Archive</button>
                    <button class="delete-btn">Delete</button>
                </div>
            `;
            return card;
        }

        function addAdminTaskEventListeners() {
            document.querySelectorAll('.complete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.admin-task-card');
                    fetch(`/api/tasks/${card.dataset.id}/complete`, { method: 'POST' })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                showToast('Task completed successfully!');
                                loadAdminTasks();
                            }
                        })
                        .catch(err => console.error('Complete task error:', err));
                });
            });

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.admin-task-card');
                    fetch('/api/tasks')
                        .then(res => res.json())
                        .then(tasks => {
                            const task = tasks.find(t => t.id == card.dataset.id);
                            editTaskForm.querySelector('input[name="id"]').value = task.id;
                            editTaskForm.querySelector('input[name="title"]').value = task.title;
                            editTaskForm.querySelector('select[name="type"]').value = task.type;
                            editTaskForm.querySelector('textarea[name="description"]').value = task.description || '';
                            editTaskForm.querySelector('input[name="due_date"]').value = task.due_date || '';
                            editTaskForm.querySelector('select[name="urgency"]').value = task.urgency;
                            editTaskForm.querySelector('select[name="allocated_to"]').value = task.allocated_to || '';
                            editTaskForm.dataset.existingImage = task.image || '';
                            editSeasonButtons.forEach(b => b.classList.remove('active'));
                            const seasonBtn = Array.from(editSeasonButtons).find(b => b.dataset.season === (task.season || 'all'));
                            if (seasonBtn) {
                                seasonBtn.classList.add('active');
                                editSeasonInput.value = task.season || 'all';
                            }
                            editTaskForm.querySelector('select[name="recurrence"]').value = task.recurrence || '';
                            editTaskModal.style.display = 'flex';
                        })
                        .catch(err => console.error('Fetch task error:', err));
                });
            });

            document.querySelectorAll('.archive-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.admin-task-card');
                    fetch(`/api/tasks/${card.dataset.id}/archive`, { method: 'POST' })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                showToast('Task archived successfully!');
                                loadAdminTasks();
                                if (archiveTasksContainer && window.location.pathname === '/archive') {
                                    loadArchiveTasks();
                                }
                            }
                        })
                        .catch(err => console.error('Archive task error:', err));
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.admin-task-card');
                    fetch(`/api/tasks/${card.dataset.id}`, { method: 'DELETE'
