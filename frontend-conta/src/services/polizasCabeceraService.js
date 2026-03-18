import api from './api';

const polizasCabeceraService = {
    getAll: () => api.get('/polizas-cabecera'),
    getById: (id) => api.get(`/polizas-cabecera/${id}`),
    create: (data) => api.post('/polizas-cabecera', data),
    update: (id, data) => api.put(`/polizas-cabecera/${id}`, data),
    delete: (id) => api.delete(`/polizas-cabecera/${id}`)
};

export default polizasCabeceraService;