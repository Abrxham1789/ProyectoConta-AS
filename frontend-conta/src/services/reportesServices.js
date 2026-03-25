import api from './api';

const reportesService = {
    getLibroDiario: () => api.get('/reportes/libro-diario'),
    getBalanceGeneral: () => api.get('/reportes/balance-general'),
    getEstadoResultados: () => api.get('/reportes/estado-resultados'),
};

export default reportesService;