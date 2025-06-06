document.addEventListener('DOMContentLoaded', () => {
    // Utility function to ensure session cookies are sent
    function fetchWithCredentials(url, options = {}) {
        options.credentials = 'include'; // Include cookies for session
        return fetch(url, options);
    }

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
    const taskFromIssueModal = document.getElementById('task-from-issue-modal');
    const closeTaskFromIssueModal = document.getElementById('close-task-from-issue-modal');
    const taskFromIssueForm = document.getElementById('task-from-issue-form');

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
                const res = await fetchWithCredentials('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                console.log('Login response:', data);
                if (data.success) {
                    console.log('Login successful, redirecting to /');
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

    // Navbar and user check
    if (navbar) {
        async function checkUserAndUpdateNavbar() {
            try {
                const res = await fetchWithCredentials('/api/current-user');
                const user = await res.json();
                console.log('Current user response:', user);
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
                    if (logoutBtn) {
                        logoutBtn.addEventListener('click', async () => {
                            try {
                                const res = await fetchWithCredentials('/api/logout', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' }
                                });
                                const data = await res.json();
                                if (data.success) {
                                    console.log('Logout successful');
                                    window.location.href = '/login';
                                } else {
                                    console.error('Logout failed:', data.message);
                                    showToast('Logout failed');
                                }
                            } catch (err) {
                                console.error('Logout error:', err);
                                showToast('Logout error');
                            }
                        });
                    }
                } else if (window.location.pathname !== '/login') {
                    console.log('Redirecting to login: no user');
                    window.location.href = '/login';
                }
            } catch (err) {
                console.error('Navbar fetch error:', err);
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }
        checkUserAndUpdateNavbar();
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
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${wsProtocol}://${window.location.host}/`);
        ws.onopen = () => console.log('WebSocket connected');
        ws.onmessage = (event) => {
            try {
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
            } catch (err) {
                console.error('WebSocket message parse error:', err);
            }
        };
        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(connectWebSocket, 10);
            setTimeout(() => {}, 5000);
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
        const taskFromIssueAllocatedTo = taskFromIssueForm?.querySelector('select[name="allocated_to"]');
        fetchWithCredentials('/api/users')
            .then(res => res.json())
            .then(users => {
                const options = `<option value="">None</option>${users.map(user => `<option value="${user.username}">${user.username}</option>`).join('')}`;
                if (dueTodayAllocatedTo) dueTodayAllocatedTo.innerHTML = options;
                if (scheduledAllocatedTo) dueTimeAllocatedTo.innerHTML = options;
                if (editAllocatedToSelect) editTask(tasks.id).innerHTML = tasks;
                else if (taskFromIssueAllocatedTo) {
                    taskFromIssue(tasks).id;
                }
            })
            .catch(err => console.error('Fetch users error:', err));

        const seasonButtons = document.querySelectorAll('#scheduled-task-form .season-btn');
        const seasonInput = document.getElementById('season-input');
        seasonButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                seasonButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                seasonInput.value = btn.dataset.season;
            });
        });

        const editSeasonButtons = editTaskForm?.querySelectorAll('.season-btn');
        const editSeasonInput = document.getElementById('edit-season-input');
        if (editSeasonButtons) {
            editSeasonButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    editSeasonButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active'));
                    editSeasonInput.value = btn.dataset.season;
                });
            });
        }

        const taskFromIssueSeasonButtons = taskFromIssueForm?.querySelectorAll('.season-btn');
        const taskFromIssueSeasonInput = document.getElementById('task-from-issue-season-input');
        if (taskFromIssueSeasonButtons && taskFromIssueSeasonInput) {
            taskFromIssueSeasonButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    taskFromIssueSeasonButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active'));
                    taskFromIssueSeasonInput.value = btn.dataset.season;
                });
            });
        }

        if (dueTodayTaskForm) {
            dueTodayTaskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(dueTodayTaskForm);
                const today = new Date().toISOString().split('T')[0];
                formData.append('due_date', today);
                formData.append('season', 'all');
                formData.append('recurrence', '');
                try {
                    const res = await fetchWithCredentials('/api/tasks', {
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
                    const res = await fetchWithCredentials('/api/tasks', {
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

        if (editTaskForm) {
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
                    const res = await fetchWithCredentials(`/api/tasks/${taskId}`, {
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
        }

        if (closeEditModal) {
            closeEditModal.addEventListener('click', () => {
                editTaskModal.style.display = 'none';
            });
        }
        if (editTaskModal) {
            window.addEventListener('click', (e) => {
                if (e.target === editTaskModal) {
                    editTaskModal.style.display = 'none';
                }
            });
        }

        function loadAdminTasks() {
            fetchWithCredentials('/api/tasks')
                .then(res => res.json())
                .then(tasks => {
                    const today = new Date().toISOString().split('T')[0];
                    const dueTodayContainer = document.querySelector('#due-today .tasks');
                    const completedContainer = document.querySelector('#completed .tasks');
                    const scheduledContainer = document.querySelector('#scheduled .tasks');

                    if (dueTodayContainer) dueTodayContainer.innerHTML = '';
                    if (completedContainer) completedContainer.innerHTML = '';
                    if (scheduledContainer) scheduledContainer.innerHTML = '';

                    // Filter tasks
                    const dueTodayTasks = tasks.filter(task => !task.archived && !task.completed && task.due_date === today);
                    const completedTasks = tasks.filter(task => !task.archived && task.completed);

                    // Group scheduled tasks by recurrence template
                    const scheduledTaskMap = new Map();
                    tasks.forEach(task => {
                        if (task.recurrence && !task.archived) {
                            const key = `${task.title}-${task.recurrence}-${task.season || 'all'}`;
                            if (!scheduledTaskMap.has(key)) {
                                scheduledTaskMap.set(key, { template: task, instances: [] });
                            }
                            scheduledTaskMap.get(key).instances.push(task);
                        }
                    });

                    const scheduledTasks = Array.from(scheduledTaskMap.values()).map(group => {
                        const hasFutureInstances = group.instances.some(task => !task.completed || (task.due_date && task.due_date > today));
                        return hasFutureInstances ? group.template : null;
                    }).filter(task => task);

                    // Render tasks
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

                    // Add image click listeners
                    document.querySelectorAll('.completion-image, .task-image').forEach(img => {
                        img.addEventListener('click', () => {
                            const modal = document.createElement('div');
                            modal.className = 'image-modal';
                            modal.innerHTML = `
                                <span class="close">×</span>
                                <img src="${img.dataset.src}" alt="Full-size Image">
                            `;
                            document.body.appendChild(modal);
                            modal.querySelector('.close').addEventListener('click', () => modal.remove());
                            modal.addEventListener('click', (e) => {
                                if (e.target === modal) modal.remove();
                            });
                        });
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
                    if (completeTaskModal) {
                        completeTaskModal.style.display = 'flex';
                        completeTaskForm.querySelector('input[name="task_id"]').value = card.dataset.id;
                    }
                });
            });

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.admin-task-card');
                    fetchWithCredentials('/api/tasks')
                        .then(res => res.json())
                        .then(tasks => {
                            const task = tasks.find(t => t.id == card.dataset.id);
                            if (!task) return;
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
                    fetchWithCredentials(`/api/tasks/${card.dataset.id}/archive`, {
                        method: 'POST'
                    })
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
                    fetchWithCredentials(`/api/tasks/${card.dataset.id}`, {
                        method: 'DELETE'
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                showToast('Task deleted successfully!');
                                loadAdminTasks();
                                if (archiveTasksContainer && window.location.pathname === '/archive') {
                                    loadArchiveTasks();
                                }
                            }
                        })
                        .catch(err => console.error('Delete task error:', err));
                });
            });
        }

        loadAdminTasks();
    }

    // Archive page
    if (archiveTasksContainer && window.location.pathname === '/archive') {
        function loadArchiveTasks() {
            fetchWithCredentials('/api/tasks')
                .then(res => res.json())
                .then(tasks => {
                    const tasksGrid = archiveTasksContainer.querySelector('.tasks');
                    tasksGrid.innerHTML = '';

                    // Filter and sort archived tasks (newest first)
                    const archivedTasks = tasks
                        .filter(task => task.archived)
                        .sort((a, b) => new Date(b.due_date || '9999-12-31') - new Date(a.due_date || '9999-12-31'));

                    // Render archived tasks
                    archivedTasks.forEach(task => {
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
                                <button class="unarchive-btn">Unarchive</button>
                                <button class="delete-btn">Delete</button>
                            </div>
                        `;
                        tasksGrid.appendChild(card);
                    });

                    // Add event listeners
                    document.querySelectorAll('.unarchive-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.admin-task-card');
                            fetchWithCredentials(`/api/tasks/${card.dataset.id}/unarchive`, {
                                method: 'POST'
                            })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('Task unarchived successfully!');
                                        loadArchiveTasks();
                                    }
                                })
                                .catch(err => console.error('Unarchive task error:', err));
                        });
                    });

                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.admin-task-card');
                            fetchWithCredentials(`/api/tasks/${card.dataset.id}`, {
                                method: 'DELETE'
                            })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('Task deleted successfully!');
                                        loadArchiveTasks();
                                    }
                                })
                                .catch(err => console.error('Delete task error:', err));
                        });
                    });

                    document.querySelectorAll('.completion-image, .task-image').forEach(img => {
                        img.addEventListener('click', () => {
                            const modal = document.createElement('div');
                            modal.className = 'image-modal';
                            modal.innerHTML = `
                                <span class="close">×</span>
                                <img src="${img.dataset.src}" alt="Full-size Image">
                            `;
                            document.body.appendChild(modal);
                            modal.querySelector('.close').addEventListener('click', () => modal.remove());
                            modal.addEventListener('click', (e) => {
                                if (e.target === modal) modal.remove();
                            });
                        });
                    });
                })
                .catch(err => console.error('Archive tasks fetch error:', err));
        }

        loadArchiveTasks();
    }

    // Staff page
    if (usersList && userForm && window.location.pathname === '/staff') {
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                modalTitle.textContent = 'Add User';
                userForm.reset();
                userForm.querySelector('input[name="id"]').value = '';
                userForm.querySelectorAll('input[name="permissions"]').forEach(checkbox => {
                    checkbox.checked = checkbox.value === 'tasks';
                });
                userModal.style.display = 'flex';
            });
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                userModal.style.display = 'none';
            });
        }

        if (userModal) {
            window.addEventListener('click', (e) => {
                if (e.target === userModal) {
                    userModal.style.display = 'none';
                }
            });
        }

        if (userForm) {
            userForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = userForm.querySelector('input[name="id"]').value;
                const username = userForm.querySelector('input[name="username"]').value;
                const password = userForm.querySelector('input[name="password"]').value;
                const role = userForm.querySelector('select[name="role"]').value;
                const permissions = Array.from(userForm.querySelectorAll('input[name="permissions"]:checked')).map(cb => cb.value);

                if (!permissions.length) {
                    document.getElementById('modal-error').style.display = 'block';
                    document.getElementById('modal-error').textContent = 'At least one page access is required';
                    return;
                }

                const url = id ? `/api/users/${id}` : '/api/users';
                const method = id ? 'PUT' : 'POST';
                const body = { username, role, permissions };
                if (password) body.password = password;

                try {
                    const res = await fetchWithCredentials(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json();
                    if (data.success) {
                        userModal.style.display = 'none';
                        userForm.reset();
                        document.getElementById('modal-error').style.display = 'none';
                        showToast(id ? 'User updated successfully!' : 'User created successfully!');
                        loadUsers();
                    } else {
                        document.getElementById('modal-error').style.display = 'block';
                        document.getElementById('modal-error').textContent = data.message || 'Failed to save user';
                    }
                } catch (err) {
                    console.error('User save error:', err);
                    document.getElementById('modal-error').style.display = 'block';
                    document.getElementById('modal-error').textContent = 'Server error';
                }
            });
        }

        function loadUsers() {
            fetchWithCredentials('/api/users')
                .then(res => res.json())
                .then(users => {
                    usersList.innerHTML = '';
                    users.forEach(user => {
                        const userId = user.id;
                        const card = document.createElement('div');
                        card.className = 'user-card';
                        card.dataset.id = userId;
                        card.innerHTML = `
                            <div class="user-info">
                                <h3>${user.username}</h3>
                                <p>Role: ${user.role}</p>
                                <p>Access: ${user.permissions.join(', ')}</p>
                            </div>
                            <div class="user-actions">
                                <button class="edit-btn">Edit</button>
                                <button class="delete-btn">Delete</button>
                            </div>
                        `;
                        usersList.appendChild(card);
                    });

                    document.querySelectorAll('.edit-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.user-card');
                            const userId = parseInt(card.dataset.id);
                            fetchWithCredentials('/api/users')
                                .then(res => res.json())
                                .then(users => {
                                    const user = users.find(u => u.id === userId);
                                    modalTitle.textContent = 'Edit User';
                                    userForm.querySelector('input[name="id"]').value = user.id;
                                    userForm.querySelector('input[name="username"]').value = user.username;
                                    userForm.querySelector('input[name="password"]').value = '';
                                    userForm.querySelector('select[name="role"]').value = user.role;
                                    userForm.querySelectorAll('input[name="permissions"]').forEach(checkbox => {
                                        checkbox.checked = user.permissions.includes(checkbox.value);
                                    });
                                    userModal.style.display = 'flex';
                                })
                                .catch(err => console.error('Fetch user error:', err));
                        });
                    });

                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.user-card');
                            fetchWithCredentials(`/api/users/${card.dataset.id}`, {
                                method: 'DELETE'
                            })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('User deleted successfully!');
                                        card.remove();
                                    }
                                })
                                .catch(err => console.error('Delete user error:', err));
                        });
                    });
                })
                .catch(err => console.error('Users fetch error:', err));
        }

        loadUsers();
    }

    // Tasks page
    if (tasksContainer && window.location.pathname === '/') {
        let currentUser = null;
        async function loadTasksPage() {
            try {
                const res = await fetchWithCredentials('/api/current-user');
                const user = await res.json();
                console.log('Tasks page current user:', user);
                if (!user) {
                    console.log('No user, redirecting to /login');
                    window.location.href = '/login';
                    return;
                }
                currentUser = user;

                const filterButtons = document.querySelectorAll('.filter-btn');
                filterButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        filterButtons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        loadTasks(btn.dataset.type);
                    });
                }));

                const defaultType = window.innerWidth <= 768 ? 'maintenance' : 'all';
                const defaultBtn = document.querySelector(`.filter-btn[data-type="${defaultType}"]`);
                if (defaultBtn) {
                    defaultBtn.classList.add('active');
                    loadTasks(defaultType);
                }

                // Raise issue button
                if (raiseIssueBtn) {
                    raiseIssueButton.addEventListener('click', async () => {
                        console.log('Raise issue button clicked');
                        const userRes = await fetch('/api/current-user', { credentials: 'include' });
                        const user = await userRes.json();
                        if (!user) {
                            console.log('No user logged in for raise issue');
                            window.location.href = '/login';
                            return;
                        }
                        if (issueForm && issueModal) {
                            issueForm.querySelector('input[name="raised_by"]').value = currentUser.username;
                            issueModal.style.display = 'flex';
                        } else {
                            console.error('Issue modal or form not found');
                            showToast('Error: Issue form not available');
                        }
                    }));
                } else {
                    console.error('Raise issue button not found');
                }

                if (closeIssueModal) {
                    closeIssueModal.addEventListener('click', () => {
                        issueModal.style.display = 'none';
                    });
                }

                if (issueModal) {
                    window.addEventListener('click', (e) => {
                        if (e.target === issueModal) {
                            issueModal.style.display = 'none';
                        }
                    });
                }

                if (issueForm) {
                    issueForm.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        console.log('Submitting issue form');
                        const formData = new FormData(issueForm);
                        try {
                            const res = await fetch('/api/issues', {
                                method: 'POST',
                                body: formData,
                                credentials: 'include'
                            });
                            const data = await res.json();
                            if (data.success) {
                                issueModal.style.display = 'none';
                                issueForm.reset();
                                document.getElementById('issue-form-error').style.display = 'none';
                                showToast('Issue raised successfully!');
                                if (issuesContainer && window.location.pathname === '/issues') {
                                    loadIssues();
                                }
                            } else {
                                document.getElementById('issue-form-error').style.display = 'block';
                                document.getElementById('issue-form-error').textContent = data.message || 'Failed to raise issue';
                            }
                        } catch (err) {
                            console.error('Issue creation error:', err);
                            document.getElementById('issue-form-error').style.display = 'block';
                            document.getElementById('issue-form-error').textContent = 'Server error';
                        }
                    }));
                }

                if (completeTaskModal) {
                    completeTaskModalForm.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const formData = new FormData(completeTaskForm);
                        const taskId = formData.get('task_id');
                        const completedImage = formData.get('completion_image');
                        const completionNote = completedData.form.get('completion_note');
                        if (!completionImage && !completionNote) {
                            document.getElementById('complete-form-error').style.display = 'block';
                            document.getElementById('complete-form-error').textContent = 'Image or note required';
                            return;
                        }
                        try {
                            const res = await fetch(`/api/tasks/${taskId}/complete`, {
                                method: 'POST',                                body: formData,
                                credentials: 'include'
                            });
                            const data = await res.json();
                            if (data.success) {
                                completeTaskModal.style.display = 'none';
                                completeTaskForm.reset();
                                document.getElementById('complete-form-error').style.display = 'none';
                                showToast('Task completed successfully!');
                                loadTasks(document.querySelector('.filter-btn.active')?.dataset.type || 'maintenance');
                            } else {
                                document.getElementById('complete-form-error').style.display = 'block';
                                document.getElementById('complete-form-error').textContent = data.message || 'Failed to complete task';
                            }
                        } catch (err) {
                            console.error('Task completion error:', err);
                            document.getElementById('complete-form-error').style.display = 'block';
                            document.getElementById('complete-form-error').textContent = 'Server error';
                        }
                    }));
                }

                if (closeCompleteModal) {
                    closeCompleteModal.addEventListener('click', () => {
                        completeTaskModal.style.display = 'none';
                    });
                }

                if (completeTaskModal) {
                    window.addEventListener('click', (e) => {
                        if (e.target === completeTaskModal) {
                            completeTaskModal.style.display = 'none';
                        }
                    });
                }
            } catch (err) {
                console.error('Current user fetch error:', err);
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }
        loadTasksPage();

        function loadTasks(type) {
            fetchWithCredentials('/api/tasks')
                .then(res => res.json())
                .then(tasks => {
                    const tasksGrid = tasksContainer.querySelector('.tasks');
                    tasksGrid.innerHTML = '';
                    const today = new Date().toISOString().split('T')[0];
                    const currentSeason = getCurrentSeason();

                    let filteredTasks = tasks
                        .filter(task => !task.archived)
                        .filter(task => !task.completed)
                        .filter(task => {
                            if (task.due_date) {
                                return task.due_date <= today;
                            }
                            return task.season === 'all' || task.season === currentSeason;
                        });

                    if (currentUser.role !== 'admin') {
                        filteredTasks = filteredTasks.filter(task => task.allocated_to === currentUser.username);
                    }

                    filteredTasks = filteredTasks.filter(task => {
                        if (type === 'all') return true;
                        if (type === 'allocated') return task.allocated_to === currentUser.username;
                        return task.type === type;
                    });

                    filteredTasks.forEach(task => {
                        const isDueToday = task.due_date === today;
                        const isOverdue = task.due_date && task.due_date < today;
                        const isUrgent = task.urgency === 'urgent';
                        const card = document.createElement('div');
                        card.className = `task-card ${task.completed ? 'completed' : ''} ${isUrgent ? 'urgent' : ''} ${isOverdue ? 'overdue' : ''}`;
                        card.dataset.id = task.id;
                        card.innerHTML = `
                            <h3 class="task-title">${task.title}</h3>
                            <p class="task-type">Type: ${task.type}</p>
                            <div class="task-details collapsed">
                                <p>Description: ${task.description || 'None'}</p>
                                <p>Due: ${task.due_date || 'None'}</p>
                                <p>Urgency: ${task.urgency}</p>
                                <p>Allocated To: ${task.allocated_to || 'None'}</p>
                                <p>Season: ${task.season || 'All'}</p>
                                ${task.recurrence ? `<p>Recurrence: ${task.recurrence}</p>` : ''}
                                ${task.image ? `<img src="${task.image}" alt="Task Image" class="task-image" data-src="${task.image}">` : ''}
                                ${task.completed ? `<p class="completed-note">Task Completed</p>` : ''}
                                ${!task.completed ? `<button class="complete-btn">Task Completed</button>` : ''}
                            </div>
                        `;
                        tasksGrid.appendChild(card);
                    });

                    document.querySelectorAll('.task-title').forEach(title => {
                        title.addEventListener('click', (e) => {
                            e.preventDefault();
                            const card = title.closest('.task-card');
                            const details = card.querySelector('.task-details');
                            details.classList.toggle('collapsed');
                        });
                    });

                    document.querySelectorAll('.complete-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.task-card');
                            if (completeTaskModal) {
                                completeTaskModal.style.display = 'flex';
                                completeTaskForm.querySelector('input[name="task_id"]').value = card.dataset.id;
                            }
                        });
                    });

                    document.querySelectorAll('.task-image').forEach(img => {
                        img.addEventListener('click', () => {
                            const modal = document.createElement('div');
                            modal.className = 'image-modal';
                            modal.innerHTML = `
                                <span class="close">×</span>
                                <img src="${img.dataset.src}" alt="Full-size Image">
                            `;
                            document.body.appendChild(modal);
                            modal.querySelector('.close').addEventListener('click', () => modal.remove());
                            modal.addEventListener('click', (e) => {
                                if (e.target === modal) modal.remove();
                            });
                        });
                    });
                })
                .catch(err => console.error('Tasks fetch error:', err));
        }
    }

    // Issues page
    if (issuesContainer && window.location.pathname === '/issues') {
        function loadIssues() {
            fetchWithCredentials('/api/issues')
                .then(res => res.json())
                .then(issues => {
                    const issuesGrid = issuesContainer.querySelector('.tasks');
                    issuesGrid.innerHTML = '';

                    issues.forEach(issue => {
                        const isUrgent = issue.urgency === 'urgent';
                        const card = document.createElement('div');
                        card.className = `issue-card ${isUrgent ? 'urgent' : ''}`;
                        card.dataset.id = issue.id;
                        card.innerHTML = `
                            <div class="issue-info">
                                <h3>${issue.location}</h3>
                                <p>Urgency: ${issue.urgency}</p>
                                <p>Description: ${issue.description || 'None'}</p>
                                <p>Raised By: ${issue.raised_by}</p>
                                <p>Created: ${new Date(issue.created_at).toLocaleString()}</p>
                                ${issue.image ? `<img src="${issue.image}" alt="Issue Image" class="task-image" data-src="${issue.image}">` : ''}
                            </div>
                            <div class="issue-actions">
                                <button class="create-task-btn">Create Task</button>
                                <button class="delete-btn">Delete</button>
                            </div>
                        `;
                        issuesGrid.appendChild(card);
                    });

                    document.querySelectorAll('.create-task-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.issue-card');
                            fetchWithCredentials('/api/issues')
                                .then(res => res.json())
                                .then(issues => {
                                    const issue = issues.find(i => i.id == parseInt(card.dataset.id));
                                    if (taskFromIssueForm) {
                                        taskFromIssueForm.querySelector('input[name="issue_id"]').value = issue.id;
                                        taskFromIssueForm.querySelector('input[name="title"]').value = `Issue: ${issue.location}`;
                                        taskFromIssueForm.querySelector('textarea[name="description"]').value = issue.description || '';
                                        taskFromIssueForm.querySelector('select[name="urgency"]').value = issue.urgency;
                                        taskFromIssueForm.dataset.existingImage = issue.image || '';
                                        taskFromIssueModal.style.display = 'flex';
                                    }
                                })
                                .catch(err => console.error('Fetch issue error:', err));
                        });
                    });

                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const card = btn.closest('.issue-card');
                            fetchWithCredentials(`/api/issues/${card.dataset.id}`, {
                                method: 'DELETE'
                            })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('Issue deleted successfully!');
                                        card.remove();
                                    }
                                })
                                .catch(err => console.error('Delete issue error:', err));
                        });
                    });

                    document.querySelectorAll('.task-image').forEach(img => {
                        img.addEventListener('click', () => {
                            const modal = document.createElement('div');
                            modal.className = 'image-modal';
                            modal.innerHTML = `
                                <span class="close">×</span>
                                <img src="${img.dataset.src}" alt="Full-size Image">
                            `;
                            document.body.appendChild(modal);
                            modal.querySelector('.close').addEventListener('click', () => modal.remove());
                            modal.addEventListener('click', (e) => {
                                if (e.target === modal) modal.remove();
                            });
                        });
                    });
                })
                .catch(err => console.error('Issues fetch error:', err));
        }

        if (taskFromIssueModal) {
            if (closeTaskFromIssueModal) {
                closeTaskFromIssueModal.addEventListener('click', () => {
                    taskFromIssueModal.style.display = 'none';
                });
            }

            window.addEventListener('click', (e) => {
                if (e.target === taskFromIssueModal) {
                    taskFromIssueModal.style.display = 'none';
                }
            });

            if (taskFromIssueForm) {
                taskFromIssueForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(taskFromIssueForm);
                    formData.append('existing_image', taskFromIssueForm.dataset.existingImage || '');
                    try {
                        const res = await fetchWithCredentials('/api/tasks/from-issue', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
                            taskFromIssueModal.style.display = 'none';
                            taskFromIssueForm.reset();
                            document.getElementById('task-from-issue-form-error').style.display = 'none';
                            showToast('Task created from issue successfully!');
                            loadIssues();
                        } else {
                            document.getElementById('task-from-issue-form-error').style.display = 'block';
                            document.getElementById('task-from-issue-form-error').textContent = data.message || 'Failed to create task';
                        }
                    } catch (err) {
                        console.error('Task from issue error:', err);
                        document.getElementById('task-from-issue-form-error').style.display = 'block';
                        document.getElementById('task-from-issue-form-error').textContent = 'Server error';
                    }
                });
            }
        }

        loadIssues();
    }
});
