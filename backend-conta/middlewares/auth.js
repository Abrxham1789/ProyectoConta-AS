const jwt = require('jsonwebtoken');

// Usamos la misma clave secreta por defecto que definimos en el módulo de usuarios
const JWT_SECRET = process.env.JWT_SECRET;

const verificarToken = (req, res, next) => {
    // Busca el token en los encabezados HTTP (Authorization Header)
    const authHeader = req.headers['authorization'];
    
    // El formato estándar es "Bearer TOKEN", así que separamos el texto por el espacio
    const token = authHeader && authHeader.split(' ')[1];

    // Si el docente o una petición externa no envía ningún token, se bloquea el paso
    if (!token) {
        return res.status(401).json({ message: "Acceso denegado. Se requiere un token de autenticación válido." });
    }

    try {
        // Se valida que el token no haya expirado y que la firma criptográfica coincida
        const verificado = jwt.verify(token, JWT_SECRET);
        
        // Inyectamos los datos del usuario autenticado directamente en la petición (req.usuario)
        req.usuario = verificado;
        
        next(); // Permite continuar hacia la consulta de Oracle en la ruta correspondiente
    } catch (error) {
        // Si el token fue alterado desde el LocalStorage, cae aquí y lo rebota
        return res.status(403).json({ message: "Token inválido, alterado o expirado." });
    }
};

module.exports = verificarToken;
