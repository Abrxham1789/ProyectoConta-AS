import api from './api';

const polizasDetalleService = {
    getAll: () => api.get('/polizas-detalle'),
    getById: (id) => api.get(`/polizas-detalle/${id}`),
    getByPoliza: (polizaId) => api.get(`/polizas-detalle/poliza/${polizaId}`),
    create: (data, userId) => api.post('/polizas-detalle', { ...data, LOGGED_USER_ID: userId }),
    update: (id, data, userId) => api.put(`/polizas-detalle/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (id, userId) => api.delete(`/polizas-detalle/${id}`, { data: { LOGGED_USER_ID: userId } }),
};

export default polizasDetalleService;