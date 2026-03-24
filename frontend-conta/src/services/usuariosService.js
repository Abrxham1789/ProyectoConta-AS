import api from './api';

const usuariosService = {
    getAll: () => api.get('/usuarios'),
    getById: (id) => api.get(`/usuarios/${id}`),
    create: (data, userId) => api.post('/usuarios', { ...data, LOGGED_USER_ID: userId }),
    update: (id, data, userId) => api.put(`/usuarios/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (id, userId) => api.delete(`/usuarios/${id}`, { data: { LOGGED_USER_ID: userId } }),
    login: (data) => api.post('/usuarios/login', data)
};

export default usuariosService;