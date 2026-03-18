import api from './api';

const periodosService = {
    getAll: () => api.get('/periodos'),
    getById: (anio, mes) => api.get(`/periodos/${anio}/${mes}`),
    create: (data) => api.post('/periodos', data),
    update: (anio, mes, data) => api.put(`/periodos/${anio}/${mes}`, data),
    delete: (anio, mes) => api.delete(`/periodos/${anio}/${mes}`)
};

export default periodosService;