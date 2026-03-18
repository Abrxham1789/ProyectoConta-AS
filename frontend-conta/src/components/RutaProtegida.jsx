import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RutaProtegida({ children }) {
    const { usuario } = useAuth();
    return usuario ? children : <Navigate to="/login" />;
}

export default RutaProtegida;