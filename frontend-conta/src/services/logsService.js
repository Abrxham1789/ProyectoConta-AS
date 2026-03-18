import api from './api';

const logsService = {
    getAll: () => api.get('/logs'),
    getById: (id) => api.get(`/logs/${id}`),
    getByUsuario: (userId) => api.get(`/logs/usuario/${userId}`),
    create: (data) => api.post('/logs', data),
    update: (id, data) => api.put(`/logs/${id}`, data),
    delete: (id) => api.delete(`/logs/${id}`)
};

export default logsService;