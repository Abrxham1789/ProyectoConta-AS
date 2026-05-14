import api from './api';
 
const reportesService = {
    getLibroDiario: (fechaDesde = '', fechaHasta = '') => {
        const params = {};
        if (fechaDesde) params.fechaDesde = fechaDesde;
        if (fechaHasta) params.fechaHasta = fechaHasta;
        return api.get('/reportes/libro-diario', { params });
    },
    getBalanceGeneral:   () => api.get('/reportes/balance-general'),
    getEstadoResultados: () => api.get('/reportes/estado-resultados'),
    getBalanceSaldos:    () => api.get('/reportes/balance-saldos'),
};
 
export default reportesService;