import api from './api';

const periodosService = {
    getAll: () => api.get('/periodos'),
    getById: (anio, mes) => api.get(`/periodos/${anio}/${mes}`),
    create: (data, userId) => api.post('/periodos', { ...data, LOGGED_USER_ID: userId }),
    update: (anio, mes, data, userId) => api.put(`/periodos/${anio}/${mes}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (anio, mes, userId) => api.delete(`/periodos/${anio}/${mes}`, { data: { LOGGED_USER_ID: userId } }),
};

export default periodosService;