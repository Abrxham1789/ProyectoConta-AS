import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// 1. INTERCEPTOR DE PETICIÓN: Pone el Token JWT automáticamente en los módulos
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); 
        if (token) {
            config.headers.Authorization = `Bearer ${token}`; 
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 2. INTERCEPTOR DE RESPUESTA CORREGIDO: Evita el bucle infinito en la pantalla de Login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // CORRECCIÓN: Si el backend da error, pero el usuario YA ESTÁ en la pantalla de login,
        // NO lo redirigimos a ningún lado para evitar que la página se congele o recargue en bomba.
        if (error.config && error.config.url.includes('/usuarios/login')) {
            return Promise.reject(error);
        }

        // Para cualquier otra ruta modular, si falla el token, sí lo expulsamos al login
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            localStorage.clear(); 
            window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default api;

