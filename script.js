// State Model
let tasks = [];
let currentFilter = 'all'; // 'all', 'high'
let searchQuery = '';

// Main Elements
const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const completedListEl = document.getElementById('completed-list');
const completedEmptyEl = document.getElementById('completed-empty');
const completedCountEl = document.getElementById('completed-count');

// Dashboard
const statTotalEl = document.getElementById('stat-total').querySelector('.stat-num');
const statPendingEl = document.getElementById('stat-pending').querySelector('.stat-num');
const statOverdueEl = document.getElementById('stat-overdue').querySelector('.stat-num');

// Modal Elements
const modal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const addBtn = document.getElementById('add-task-btn');
const closeBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');

// Theme
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('i');

// Init
function init() {
    loadTasks();
    loadTheme();
    setupEventListeners();
    render();
    
    if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    // Check for reminders initially and every minute
    checkReminders();
    setInterval(checkReminders, 60000);
}

function checkReminders() {
    if (!window.Notification || Notification.permission !== "granted") return;
    
    let needsSave = false;
    const now = new Date().getTime();
    const msInDay = 24 * 60 * 60 * 1000;
    const msInHour = 60 * 60 * 1000;
    
    tasks.forEach(task => {
        if (task.completed || !task.deadline) return;
        
        const taskTime = new Date(task.deadline).getTime();
        const diff = taskTime - now;
        
        // 1 Day Reminder
        if (diff > 0 && diff <= msInDay && !task.notified1Day) {
            new Notification("Task Due Tomorrow", {
                body: `"${task.title}" is due in less than 24 hours.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/7486/7486744.png'
            });
            task.notified1Day = true;
            needsSave = true;
        }
        
        // 1 Hour Reminder
        if (diff > 0 && diff <= msInHour && !task.notified1Hour) {
            new Notification("Task Due Soon", {
                body: `"${task.title}" is due in less than 1 hour! Time to wrap it up.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/7486/7486744.png'
            });
            task.notified1Hour = true;
            needsSave = true;
        }
    });
    
    if (needsSave) {
        saveTasks();
    }
}

function loadTasks() {
    // Attempt backend sync
    fetch('/api/tasks')
        .then(response => response.json())
        .then(data => {
            tasks = data;
            render();
        })
        .catch(e => {
            console.error("Backend unresponsive, falling back to cached persistence layer.");
            showToast("Offline Mode. Reconnect to Wi-Fi to sync devices.", "warning");
        });
}

function saveTasks() {
    // Send full state tree safely to Python backend securely
    fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks)
    }).catch(e => {
        showToast("Error syncing to backend server", "danger");
    });
}

function loadTheme() {
    const isDark = localStorage.getItem('smartTask_dark_mode') === 'true';
    if (isDark) {
        document.body.classList.replace('light-mode', 'dark-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
        document.body.classList.replace('dark-mode', 'light-mode');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('smartTask_dark_mode', 'false');
    } else {
        document.body.classList.replace('light-mode', 'dark-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('smartTask_dark_mode', 'true');
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-circle-check';
    if (type === 'danger') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if(container.contains(toast)) container.removeChild(toast); }, 3500);
}

const getPriorityWeight = (pri) => ({ 'high': 3, 'medium': 2, 'low': 1 }[pri] || 1);

// Core Render Logic
function render() {
    updateDashboardStats();

    // 1. Split active vs completed
    let activeTasks = tasks.filter(t => !t.completed);
    let completedTasks = tasks.filter(t => t.completed);

    // 2. Sort completed (recent first)
    completedTasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 3. Filter & Sort Active
    activeTasks = activeTasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery) || 
                              (task.description && task.description.toLowerCase().includes(searchQuery));
        if (!matchesSearch) return false;
        if (currentFilter === 'high') return task.priority === 'high';
        return true;
    });

    activeTasks.sort((a, b) => {
        const priDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        if (priDiff !== 0) return priDiff;
        const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aTime - bTime;
    });

    renderActiveTasks(activeTasks);
    renderCompletedTasks(completedTasks);
}

function updateDashboardStats() {
    const totalActive = tasks.filter(t => !t.completed).length;
    const completedCount = tasks.filter(t => t.completed).length;
    const now = new Date().getTime();
    const overdue = tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline).getTime() < now).length;

    completedCountEl.innerText = completedCount;
    animateValue(statTotalEl, parseInt(statTotalEl.innerText) || 0, totalActive, 400);
    animateValue(statPendingEl, parseInt(statPendingEl.innerText) || 0, totalActive, 400);
    animateValue(statOverdueEl, parseInt(statOverdueEl.innerText) || 0, overdue, 400);
}

function animateValue(obj, start, end, duration) {
    if (start === end) { obj.innerHTML = end; return; }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerHTML = end;
    };
    window.requestAnimationFrame(step);
}

function renderActiveTasks(activeTasks) {
    taskListEl.innerHTML = '';
    const now = new Date().getTime();
    const oneDay = 24 * 3600 * 1000;

    if (activeTasks.length === 0) {
        taskListEl.classList.add('hidden');
        emptyStateEl.classList.remove('hidden');
    } else {
        taskListEl.classList.remove('hidden');
        emptyStateEl.classList.add('hidden');

        activeTasks.forEach(task => {
            let isOverdue = false, isUpcoming = false, formattedDate = '';
            if (task.deadline) {
                const taskTime = new Date(task.deadline).getTime();
                if (taskTime < now) isOverdue = true;
                else if (taskTime - now <= oneDay) isUpcoming = true;
                
                const d = new Date(task.deadline);
                formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            }

            const card = document.createElement('div');
            card.className = `task-card priority-${task.priority} ${isOverdue ? 'overdue' : ''}`;
            card.innerHTML = `
                <div class="task-indicator"></div>
                ${isUpcoming ? '<div class="upcoming-badge">⏰ Soon</div>' : ''}
                <div class="task-checkbox-container">
                    <input type="checkbox" class="task-checkbox" data-id="${task.id}">
                </div>
                <div class="task-content">
                    <div class="task-header">
                        <h3 class="task-title">${escapeHTML(task.title)}</h3>
                        <div class="task-actions">
                            <button class="btn-icon mini edit-btn" data-id="${task.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon mini delete delete-btn" data-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    ${task.description ? `<p class="task-desc">${escapeHTML(task.description).replace(/\n/g, '<br>')}</p>` : ''}
                    <div class="task-meta">
                        ${formattedDate ? `<div class="meta-item ${isOverdue ? 'overdue' : ''}"><i class="fa-regular fa-clock"></i> ${formattedDate} ${isOverdue ? '(Overdue)' : ''}</div>` : ''}
                        <div class="meta-item"><i class="fa-solid fa-flag"></i> ${capitalize(task.priority)}</div>
                    </div>
                </div>
            `;
            taskListEl.appendChild(card);
        });
    }
}

function renderCompletedTasks(completedTasks) {
    completedListEl.innerHTML = '';
    
    if (completedTasks.length === 0) {
        completedEmptyEl.classList.remove('hidden');
    } else {
        completedEmptyEl.classList.add('hidden');
        completedTasks.forEach(task => {
            const d = new Date(task.createdAt);
            const dateStr = d.toLocaleDateString();

            const card = document.createElement('div');
            card.className = 'mini-task-card';
            card.innerHTML = `
                <div class="mini-task-check">
                    <input type="checkbox" class="task-checkbox" checked data-id="${task.id}">
                </div>
                <div class="mini-task-content">
                    <div class="mini-task-title">${escapeHTML(task.title)}</div>
                    <div class="mini-task-date">Added ${dateStr}</div>
                </div>
                <button class="btn-icon mini delete delete-btn" data-id="${task.id}"><i class="fa-solid fa-trash"></i></button>
            `;
            completedListEl.appendChild(card);
        });
    }
}

// Logic Actions
function addTask(e) {
    e.preventDefault();
    if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const dateVal = document.getElementById('task-date').value;
    const timeVal = document.getElementById('task-time').value;
    const deadline = dateVal ? `${dateVal}T${timeVal || '00:00'}` : '';
    const priority = document.getElementById('task-priority').value;

    if (id) {
        const index = tasks.findIndex(t => t.id === id);
        if (index > -1) {
            tasks[index] = { ...tasks[index], title, description: desc, deadline, priority };
            showToast('Task updated successfully');
        }
    } else {
        tasks.push({ id: Date.now().toString(), title, description: desc, deadline, priority, completed: false, createdAt: new Date().toISOString() });
        showToast('New task locked in');
    }
    saveTasks(); closeModal(); render();
}

function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks(); render();
        if (task.completed) showToast('Task archived to history', 'success');
        else showToast('Task restored to active workspace', 'warning');
    }
}

function deleteTask(id) {
    if(confirm('Delete this task permanently?')) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks(); render();
        showToast('Task wiped securely', 'danger');
    }
}

function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        if (task.deadline) {
            const [d, t] = task.deadline.split('T');
            document.getElementById('task-date').value = d || '';
            document.getElementById('task-time').value = t ? t.slice(0,5) : '';
        } else {
            document.getElementById('task-date').value = '';
            document.getElementById('task-time').value = '';
        }
        document.getElementById('task-priority').value = task.priority;
        modalTitle.innerText = 'Edit Task';
        modal.classList.remove('hidden');
    }
}

function openModal() {
    taskForm.reset();
    document.getElementById('task-id').value = '';
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const isoString = now.toISOString().slice(0,16);
    const [d, t] = isoString.split('T');
    document.getElementById('task-date').value = d;
    document.getElementById('task-time').value = t;
    modalTitle.innerText = 'New Task';
    modal.classList.remove('hidden');
    document.getElementById('task-title').focus();
}

function closeModal() { modal.classList.add('hidden'); }

// Listeners
function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    addBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    taskForm.addEventListener('submit', addTask);

    const handleDelegation = (e) => {
        const checkbox = e.target.closest('.task-checkbox');
        if (checkbox) toggleComplete(checkbox.dataset.id);
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) deleteTask(deleteBtn.dataset.id);
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) openEditModal(editBtn.dataset.id);
    };

    taskListEl.addEventListener('click', handleDelegation);
    completedListEl.addEventListener('click', handleDelegation);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            render();
        });
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        render(); // Real-time search
    });
}

// Escapes
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

document.addEventListener('DOMContentLoaded', init);
