import api from './api';

const configuracionReportesService = {
    getAll: () => api.get('/configuracion-reportes'),
    getById: (id) => api.get(`/configuracion-reportes/${id}`),
    create: (data, userId) => api.post('/configuracion-reportes', { ...data, LOGGED_USER_ID: userId }),
    update: (id, data, userId) => api.put(`/configuracion-reportes/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (id, userId) => api.delete(`/configuracion-reportes/${id}`, { data: { LOGGED_USER_ID: userId } }),
};

export default configuracionReportesService;