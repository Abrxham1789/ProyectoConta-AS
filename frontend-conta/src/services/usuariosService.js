import api from './api';

const usuariosService = {
    // Obtiene todos los usuarios (El interceptor de api.js inyecta el token automáticamente)
    getAll: () => api.get('/usuarios'),
    
    // Obtiene un usuario específico por su ID
    getById: (id) => api.get(`/usuarios/${id}`),
    
    // Crea un usuario nuevo (Ya no requiere mandar el LOGGED_USER_ID en el JSON)
    create: (data) => api.post('/usuarios', data),
    
    // Actualiza los datos de un usuario por su ID
    update: (id, data) => api.put(`/usuarios/${id}`, data),
    
    // Elimina un usuario del sistema (Se simplificó eliminando el envío de datos en el cuerpo)
    delete: (id) => api.delete(`/usuarios/${id}`),
    
    // Envía las credenciales para iniciar sesión y recibir el Token JWT
    login: (data) => api.post('/usuarios/login', data)
};

export default usuariosService;
