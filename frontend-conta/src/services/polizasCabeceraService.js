import api from './api';

const polizasCabeceraService = {
    getAll: () => api.get('/polizas-cabecera'),
    getById: (id) => api.get(`/polizas-cabecera/${id}`),
    create: (data, userId) => api.post('/polizas-cabecera', { ...data, LOGGED_USER_ID: userId }),
    update: (id, data, userId) => api.put(`/polizas-cabecera/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (id, userId) => api.delete(`/polizas-cabecera/${id}`, { data: { LOGGED_USER_ID: userId } }),
    createUnificado: (data, userId) => api.post('/polizas-unificado', { ...data, LOGGED_USER_ID: userId })
};

export default polizasCabeceraService;