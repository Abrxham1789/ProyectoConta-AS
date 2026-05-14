import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(
        JSON.parse(localStorage.getItem('usuario')) || null
    );

    const login = (user) => {
        setUsuario(user);
        localStorage.setItem('usuario', JSON.stringify(user));
    };

    const logout = () => {
        setUsuario(null);
        // BLINDAJE: Limpiamos absolutamente todo el almacenamiento local
        // Esto elimina el objeto usuario, el token JWT y cualquier rastro de la sesión
        localStorage.clear(); 
    };

    return (
        <AuthContext.Provider value={{ usuario, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
