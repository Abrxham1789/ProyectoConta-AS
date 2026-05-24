import api from './api';

const cuentasService = {
    // Ahora acepta prefijo Y search; si llegan vacíos no se mandan como params
    getAll: (prefijo = '', search = '') => {
        const params = {};
        if (prefijo) params.prefijo = prefijo;
        if (search)  params.search  = search;
        return api.get('/cuentas', { params });
    },

    // REQ 3 — Verificación async de duplicados antes de guardar
    // Acepta: { id }, { nombre }, { nombre, excludeId }
    checkDuplicado: (params) => api.get('/cuentas/check-duplicado', { params }),

    getById: (id)           => api.get(`/cuentas/${id}`),
    create:  (data, userId) => api.post('/cuentas', { ...data, LOGGED_USER_ID: userId }),
    update:  (id, data, userId) => api.put(`/cuentas/${id}`, { ...data, LOGGED_USER_ID: userId }),
    delete:  (id, userId)   => api.delete(`/cuentas/${id}`, { data: { LOGGED_USER_ID: userId } }),
};

export default cuentasService;