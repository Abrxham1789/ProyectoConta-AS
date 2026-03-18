import api from './api';

const hojaTrabajoService = {
    getAll: () => api.get('/hoja-trabajo'),
    getByPeriodo: (anio, mes) => api.get(`/hoja-trabajo/${anio}/${mes}`),
    create: (data) => api.post('/hoja-trabajo', data),
    update: (anio, mes, cuentaId, data) => api.put(`/hoja-trabajo/${anio}/${mes}/${cuentaId}`, data),
    delete: (anio, mes, cuentaId) => api.delete(`/hoja-trabajo/${anio}/${mes}/${cuentaId}`)
};

export default hojaTrabajoService;