import api from './api';

const configuracionReportesService = {
    getAll: () => api.get('/configuracion-reportes'),
    getById: (id) => api.get(`/configuracion-reportes/${id}`),
    create: (data) => api.post('/configuracion-reportes', data),
    update: (id, data) => api.put(`/configuracion-reportes/${id}`, data),
    delete: (id) => api.delete(`/configuracion-reportes/${id}`)
};

export default configuracionReportesService;