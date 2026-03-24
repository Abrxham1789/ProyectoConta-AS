import api from './api';

const hojaTrabajoService = {
    getAll: () => api.get('/hoja-trabajo'),
    getByPeriodo: (anio, mes) => api.get(`/hoja-trabajo/${anio}/${mes}`),
    create: (data, userId) => api.post('/hoja-trabajo', { ...data, LOGGED_USER_ID: userId }),
    update: (anio, mes, cuentaId, data, userId) => api.put(`/hoja-trabajo/${anio}/${mes}/${cuentaId}`, { ...data, LOGGED_USER_ID: userId }),
    delete: (anio, mes, cuentaId, userId) => api.delete(`/hoja-trabajo/${anio}/${mes}/${cuentaId}`, { data: { LOGGED_USER_ID: userId } }),
};

export default hojaTrabajoService;