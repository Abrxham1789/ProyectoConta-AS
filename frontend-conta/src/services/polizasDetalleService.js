import api from './api';

const polizasDetalleService = {
    getAll: () => api.get('/polizas-detalle'),
    getById: (id) => api.get(`/polizas-detalle/${id}`),
    getByPoliza: (polizaId) => api.get(`/polizas-detalle/poliza/${polizaId}`),
    create: (data) => api.post('/polizas-detalle', data),
    update: (id, data) => api.put(`/polizas-detalle/${id}`, data),
    delete: (id) => api.delete(`/polizas-detalle/${id}`)
};

export default polizasDetalleService;