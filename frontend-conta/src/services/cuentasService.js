import api from './api';

const cuentasService = {
    getAll: () => api.get('/cuentas'),
    getById: (id) => api.get(`/cuentas/${id}`),
    create: (data) => api.post('/cuentas', data),
    update: (id, data) => api.put(`/cuentas/${id}`, data),
    delete: (id) => api.delete(`/cuentas/${id}`)
};

export default cuentasService;