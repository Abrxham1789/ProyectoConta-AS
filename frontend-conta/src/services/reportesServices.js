import api from './api';

const reportesService = {
    // Recibe un string de query params (ej: "?anio=2026&mes=5") o un objeto
    getLibroDiario: (queryParams = '') => {
        return api.get(`/reportes/libro-diario${queryParams}`);
    },
    
    getBalanceGeneral: (queryParams = '') => {
        return api.get(`/reportes/balance-general${queryParams}`);
    },
    
    getEstadoResultados: (queryParams = '') => {
        return api.get(`/reportes/estado-resultados${queryParams}`);
    },
    
    getBalanceSaldos: (queryParams = '') => {
        return api.get(`/reportes/balance-saldos${queryParams}`);
    },
};

export default reportesService;
