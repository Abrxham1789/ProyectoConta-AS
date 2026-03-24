import api from './api';

const cuentasService = {
    getAll: () => api.get('/cuentas'),
    getById: (id) => api.get(`/cuentas/${id}`),
    create: (data, userId) => api.post('/cuentas', { ...data, LOGGED_USER_ID: userId }),
    update: (id, data, userId) => api.put(`/cuentas/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (id, userId) => api.delete(`/cuentas/${id}`, { data: { LOGGED_USER_ID: userId } }),
};

export default cuentasService;