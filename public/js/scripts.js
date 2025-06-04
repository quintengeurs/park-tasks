document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const tasksContainer = document.getElementById('tasks');
    const adminTasksContainer = document.getElementById('admin-tasks');
    const archiveTasksContainer = document.getElementById('archive-tasks');
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
    // New elements for issues and inspections
    const issueBtn = document.getElementById('raiseIssueBtn');
    const issueModal = document.getElementById('issueModal');
    const inspectionBtn = document.getElementById('recordInspectionBtn');

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
                    navbar.innerHTML = `
                        <a href="/">Tasks</a>
                        <a href="/admin">Admin</a>
                        <a href="/archive">Archive</a>
                        <a href="/staff">Staff Management</a>
                        <a href="/issues">Issues</a>
                        <a href="/inspections">Inspections</a>
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
        ws = new WebSocket('wss://park-tasks.onrender.com/');
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
            // New: Handle issues updates
            if (data.type === 'new_issue' && window.location.pathname === '/issues') {
                loadIssues();
            }
            // New: Handle inspections updates
            if (data.type === 'new_inspection' && window.location.pathname === '/inspections') {
                loadInspections();
            }
        };
        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(connectWebSocket, 5000);
        };
        ws.onerror = (err) => console.error('WebSocket error:', err);
    }
    if (tasksContainer || adminTasksContainer || archiveTasksContainer) {
        connectWebSocket();
    }

    // Admin page: Task forms and list
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
                    const scheduledTasks = tasks.filter(task => !task.archived && task.recurrence && !task.original_task_id);

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
                    fetch(`/${card.dataset.id}`, { method: 'DELETE' })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                card.remove();
                                if (archiveTasksContainer && window.location.pathname === '/archive') {
                                    loadArchiveTasks();
                                }
                            }
                        })
                        .catch(err => console.error('Delete task error:', err));
                });
            });

            loadAdminTasks();
        }

        // Archive page
        if (archiveTasksContainer && window.location.pathname === '/archive') {
            function loadArchiveTasks() {
                fetch('/api/tasks')
                    .then(res => res.json())
                    .then(tasks => {
                        const tasksGrid = archiveTasksContainer.querySelector('.tasks');
                        tasksGrid.innerHTML = '';

                        const archivedTasks = tasks.filter(task => task.archived);

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
                                </div>
                                <div class="task-actions">
                                    ${task.completed ? `<p class="completed-note">Task Completed</p>` : ''}
                                    <button class="delete-btn">Delete</button>
                                </div>
                            </div>
                            `;
                            tasksGrid.appendChild(card);
                        });

                        document.querySelectorAll('.admin-task-card .delete-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const card = btn.closest('.admin-task-card');
                                fetch(`/api/tasks/${card.dataset.id}`, { method: 'DELETE' })
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.success) {
                                            card.remove();
                                        }
                                    })
                                    .catch(err => console.error('Delete task error:', err));
                            });
                        });
                    })
                    .catch(err => console.error('Archive tasks fetch error:', err));
            }

            loadArchiveTasks();
        }

        // Staff page: User management
        if (usersList && userForm && window.location.pathname === '/staff') {
            addUserBtn.addEventListener('click', () => {
                modalTitle.textContent = 'Add User';
                userForm.reset();
                userForm.querySelector('input[name="id"]').value = '';
                userModal.style.display = 'flex';
            });

            closeModal.addEventListener('click', () => {
                userModal.style.display = 'none';
            });

            window.addEventListener('click', (e) => {
                if (e.target === userModal) {
                    userModal.style.display = 'none';
                }
            });

            userForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = userForm.querySelector('input[name="id"]').value;
                const username = userForm.querySelector('input[name="username"]').value;
                const password = userForm.querySelector('input[name="password"]').value;
                const role = userForm.querySelector('select[name="role"]').value;

                const url = id ? `/api/users/${id}` : '/api/users';
                const method = id ? 'PUT' : 'POST';

                try {
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password, role })
                    });
                    const data = await res.json();
                    if (data.success) {
                        userModal.style.display = 'none';
                        userForm.reset();
                        document.getElementById('modal-error').textContent = '';
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

            function loadUsers() {
                fetch('/api/users')
                    .then(res => res.json())
                    .then(users => {
                        usersList.innerHTML = '';
                        users.forEach(user => {
                            const card = document.createElement('div');
                            card.className = 'user-card';
                            card.dataset.id = user.id;
                            card.innerHTML = `
                                <div class="user-info">
                                    <h3>${user.username}</h3>
                                    <p>Role: ${user.role}</p>
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
                                const userId = card.dataset.id;
                                fetch(`/api/users`)
                                    .then(res => res.json())
                                    .then(users => {
                                        const user = users.find(u => u.id == userId);
                                        modalTitle.textContent = 'Edit User';
                                        userForm.querySelector('input[name="id"]').value = user.id;
                                        userForm.querySelector('input[name="username"]').value = user.username;
                                        userForm.querySelector('input[name="password"]').value = '';
                                        userForm.querySelector('select[name="role"]').value = user.role;
                                        userModal.style.display = 'flex';
                                    })
                                    .catch(err => console.error('Fetch user error:', err));
                            });
                        });

                        document.querySelectorAll('.delete-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const card = btn.closest('.user-card');
                                fetch(`/api/users/${card.dataset.id}`, { method: 'DELETE' })
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.success) {
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
            const filterButtons = document.querySelectorAll('.filter-btn');
            let currentUser = null;
            const currentSeason = getCurrentSeason();

            fetch('/api/current-user')
                .then(res => res.json())
                .then(user => {
                    if (!user) {
                        window.location.href = '/login';
                        return;
                    }
                    currentUser = user;
                    filterButtons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            filterButtons.forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            loadTasks(btn.dataset.type);
                        });
                    });
                    const defaultType = window.innerWidth <= 600 ? 'maintenance' : 'all';
                    document.querySelector(`.filter-btn[data-type="${defaultType}"]`)?.classList.add('active');
                    loadTasks(defaultType);
                })
                .catch(err => {
                    console.error('Current user fetch error:', err);
                    window.location.href = '/login';
                });

            function loadTasks(type) {
                fetch('/api/tasks')
                    .then(res => res.json())
                    .then(tasks => {
                        const tasksGrid = tasksContainer.querySelector('.tasks');
                        tasksGrid.innerHTML = '';
                        const today = new Date().toISOString().split('T')[0];

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
                                fetch(`/api/tasks/${card.dataset.id}/complete`, { method: 'POST' })
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.success) {
                                            card.classList.add('completed');
                                            card.classList.remove('overdue');
                                            const details = card.querySelector('.task-details');
                                            details.classList.add('collapsed');
                                            btn.remove();
                                            const note = document.createElement('p');
                                            note.className = 'completed-note';
                                            note.textContent = 'Task Completed';
                                            details.appendChild(note);
                                        }
                                    })
                                    .catch(err => console.error('Complete task error:', err));
                            });
                        });

                        document.querySelectorAll('.task-image').forEach(img => {
                            img.addEventListener('click', () => {
                                const modal = document.createElement('div');
                                modal.className = 'image-modal';
                                modal.innerHTML = `
                                    <span class="close">×</span>
                                    <img src="${img.dataset.src}" alt="Full-size Task Image">
                                `;
                                document.body.appendChild(modal);
                                modal.querySelector('.close').addEventListener('click', () => {
                                    modal.remove();
                                });
                                modal.addEventListener('click', (e) => {
                                    if (e.target === modal) {
                                        modal.remove();
                                    }
                                });
                            });
                        });
                    })
                    .catch(err => console.error('Tasks fetch error:', err));
            }
        }

        // New: Issues page
        if (window.location.pathname === '/issues') {
            function loadIssues() {
                fetch('/api/issues')
                    .then(res => res.json())
                    .then(issues => {
                        const issuesGrid = document.querySelector('.task-list');
                        if (issuesGrid) {
                            issuesGrid.innerHTML = '';
                            issues.forEach(issue => {
                                const card = document.createElement('div');
                                card.className = `task-card ${issue.urgency === 'High' ? 'high-urgency' : ''}`;
                                card.innerHTML = `
                                    <h3>${issue.title}</h3>
                                    <p><strong>Description:</strong> ${issue.description}</p>
                                    <p><strong>Location:</strong> ${issue.location}</p>
                                    <p><strong>Urgency:</strong> ${issue.urgency}</p>
                                    <p><strong>Reported:</strong> ${issue.created_at}</p>
                                    ${issue.image_path ? `<img src="${issue.image_path}" alt="Issue Image" class="task-image">` : ''}
                                `;
                                issuesGrid.appendChild(card);
                            });
                        }
                    })
                    .catch(err => console.error('Issues fetch error:', err));
            }
            loadIssues();
        }

        // New: Inspections page
        if (window.location.pathname === '/inspections') {
            function loadInspections() {
                fetch('/api/inspections')
                    .then(res => res.json())
                    .then(inspections => {
                        const inspectionsGrid = document.querySelector('.task-list');
                        if (inspectionsGrid) {
                            inspectionsGrid.innerHTML = '';
                            inspections.forEach(inspection => {
                                const card = document.createElement('div');
                                card.className = 'task-card';
                                card.innerHTML = `
                                    <h3>${inspection.type} - ${inspection.subtype || 'N/A'}</h3>
                                    <p><strong>Location:</strong> ${inspection.location}</p>
                                    <p><strong>Date:</strong> ${inspection.created_at}</p>
                                    ${inspection.notes ? `<p><strong>Notes:</strong> ${inspection.notes}</p>` : ''}
                                `;
                                inspectionsGrid.appendChild(card);
                            });
                        }
                    })
                    .catch(err => console.error('Inspections fetch error:', err));
            }
            loadInspections();
        }

        // New: Issue modal handling
        if (issueBtn && issueModal) {
            issueBtn.addEventListener('click', () => {
                issueModal.style.display = 'block';
            });

            const closeButtons = issueModal.querySelectorAll('.close');
            closeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    issueModal.style.display = 'none';
                });
            });

            window.addEventListener('click', (event) => {
                if (event.target === issueModal) {
                    issueModal.style.display = 'none';
                }
            });
        }

        // New: Inspections navigation
        if (inspectionBtn) {
            inspectionBtn.addEventListener('click', () => {
                window.location.href = '/inspections';
            });
        }
    });
