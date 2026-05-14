import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RutaProtegida({ children, rolesPermitidos }) {
    const { usuario } = useAuth();

    // 1. Si no hay usuario logueado, directo al login
    if (!usuario) {
        return <Navigate to="/login" />;
    }

    // 2. Si la ruta exige roles específicos y el usuario no lo cumple, lo rebota al Home
    if (rolesPermitidos && !rolesPermitidos.includes(usuario?.ROL)) {
        return <Navigate to="/" />;
    }

    return children;
}

export default RutaProtegida;
