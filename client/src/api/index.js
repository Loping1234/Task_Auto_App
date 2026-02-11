import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    verify2FA: (email, otp) => api.post('/auth/verify-2fa', { email, otp }),
    signup: (email, password) => api.post('/auth/signup', { email, password }),
    verifyEmail: (email, token) => api.post('/auth/verify-email', { email, token }),
    resendOtp: (email) => api.post('/auth/resend-otp', { email }),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
};

// Tasks API
export const tasksAPI = {
    getAll: () => api.get('/tasks'),
    getById: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    update: (id, data, config = {}) => api.put(`/tasks/${id}`, data, config),
    updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
    updateAssignee: (id, assignee) => api.patch(`/tasks/${id}/assignee`, { assignee }),
    delete: (id) => api.delete(`/tasks/${id}`),
    addComment: (id, data) => api.post(`/tasks/${id}/comments`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    getTaskboard: () => api.get('/tasks/board'),
    getTeamTasks: () => api.get('/tasks/team-tasks'),
};

// Teams API
export const teamsAPI = {
    getAll: () => api.get('/teams'),
    getById: (name) => api.get(`/teams/${encodeURIComponent(name)}`),
    create: (data) => api.post('/teams', data),
    update: (name, data) => api.put(`/teams/${encodeURIComponent(name)}`, data),
    delete: (name) => api.delete(`/teams/${encodeURIComponent(name)}`),
};

// Project API
export const projectsAPI = {
    getAll: () => api.get('/projects'),
    getById: (id) => api.get(`/projects/${id}`),
    create: (data) => api.post('/projects', data),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    addMembers: (id, data) => api.post(`/projects/${id}/members`, data),
    removeMember: (id, userId, memberType) => api.delete(`/projects/${id}/members`, { data: { userId, memberType } }),
    updateStatuses: (id, customStatuses) => api.put(`/projects/${id}/statuses`, { customStatuses }),
    addTask: (id, taskId) => api.post(`/projects/${id}/tasks`, { taskId }),
    removeTask: (id, taskId) => api.delete(`/projects/${id}/tasks`, { data: { taskId } }),
};

// Employees API
export const employeesAPI = {
    getAll: () => api.get('/employees'),
    getById: (email) => api.get(`/employees/${encodeURIComponent(email)}`),
};

// Subadmins API
export const subadminsAPI = {
    getAll: () => api.get('/subadmins'),
};

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard'),
};

// Chat API
export const chatAPI = {
    // Team Chat (Employee)
    getEmployeeTeams: () => api.get('/chat/teams'),
    getTeamMessages: (teamName) => api.get(`/chat/team/${encodeURIComponent(teamName)}`),
    sendTeamMessage: (teamName, message) => api.post(`/chat/team/${encodeURIComponent(teamName)}`, { message }),

    // Admin-Subadmin Chat
    getSubadmins: () => api.get('/subadmins'),
    getAdminSubadminMessages: (channel) => api.get(`/chat/admin?channel=${encodeURIComponent(channel)}`),
    sendAdminSubadminMessage: (receiverEmail, message, channel) =>
        api.post('/chat/admin', { receiverEmail, message, channel }),
};

// Messages API (legacy, kept for backwards compatibility)
export const messagesAPI = {
    getTeamMessages: (teamName) => api.get(`/messages/team/${encodeURIComponent(teamName)}`),
    sendTeamMessage: (teamName, message) => api.post(`/messages/team/${encodeURIComponent(teamName)}`, { message }),
    getAdminChat: () => api.get('/messages/admin-chat'),
    sendAdminMessage: (message) => api.post('/messages/admin-chat', { message }),
};

// Notifications API
export const notificationAPI = {
    getAll: (params = {}) => api.get('/notifications', { params }),
    markRead: (id) => api.put(`/notifications/${id}/read`),
    markUnread: (id) => api.put(`/notifications/${id}/unread`),
    markAllRead: () => api.put('/notifications/read-all'),
};

// Users API
export const usersAPI = {
    getAll: () => api.get('/users/all'),
};

// Watchlist API
export const watchlistAPI = {
    // Get my watchlist settings (who I've granted access to)
    getMySettings: () => api.get('/watchlist/my-settings'),
    // Update my watchlist (add/remove watchers with their allowed types)
    update: (watchers) => api.put('/watchlist/update', { watchers }),
    // Get list of users who have granted me access to watch their notifications
    getWhoICanWatch: () => api.get('/watchlist/i-can-watch'),
};

export default api;