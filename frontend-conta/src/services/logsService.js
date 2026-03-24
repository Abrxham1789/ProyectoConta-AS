import api from './api';

const logsService = {
    getAll: () => api.get('/logs'),
    getById: (id) => api.get(`/logs/${id}`),
    getByUsuario: (userId) => api.get(`/logs/usuario/${userId}`),
    create: (data, userId) => api.post('/logs', { ...data, LOGGED_USER_ID: userId }),
    update: (id, data, userId) => api.put(`/logs/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (id, userId) => api.delete(`/logs/${id}`, { data: { LOGGED_USER_ID: userId } }),
};

export default logsService;