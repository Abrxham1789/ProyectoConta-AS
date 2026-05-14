import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Reportes from './components/Reportes';
import Polizas from './components/Polizas';
import Login from './components/Login';
import RutaProtegida from './components/RutaProtegida';
import CatalogoCuentas from './components/CatalogoCuentas';
import Periodos from './components/Periodos';
import ConfiguracionReportes from './components/ConfiguracionReportes';
import HojaTrabajoSaldos from './components/HojaTrabajoSaldos';
import UsuariosContables from './components/UsuariosContables';
import LogsAuditoria from './components/LogsAuditoria';

const modulos = [
    { label: 'Catálogo de Cuentas', path: '/cuentas', icon: '📒' },
    { label: 'Pólizas Contables', path: '/polizas', icon: '📒' },
    { label: 'Periodos de Cierre', path: '/periodos', icon: '📅' },
    { label: 'Configuración Reportes', path: '/configuracion-reportes', icon: '⚙️' },
    { label: 'Reportes Financieros', path: '/reportes', icon: '📈' },
    { label: 'Hoja de Trabajo', path: '/hoja-trabajo', icon: '📊' },
    { label: 'Usuarios', path: '/usuarios', icon: '👤' },
    { label: 'Logs Auditoría', path: '/logs', icon: '🔍' },
];

function Home() {
    const navigate = useNavigate();
    const { usuario, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-wide">Sistema Contable</h1>
                        <p className="text-blue-200 text-sm">Panel de Administración</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-white font-semibold text-sm">{usuario?.USERNAME}</p>
                            <p className="text-blue-200 text-xs">{usuario?.ROL}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-10">
                <h2 className="text-[#1E3A5F] text-2xl font-semibold mb-1">Módulos del Sistema</h2>
                <p className="text-gray-500 text-sm mb-8">Selecciona un módulo para comenzar</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {modulos
                        .filter((mod) => {
                            // Si el módulo es de Usuarios o Logs, exige estrictamente el rol ADMIN
                            if (mod.path === '/usuarios' || mod.path === '/logs') {
                                return usuario?.ROL === 'ADMIN';
                            }
                            return true; // Los demás módulos quedan visibles para todos
                        })
                        .map((mod) => (
                            <button
                                key={mod.path}
                                onClick={() => navigate(mod.path)}
                                className="bg-white border border-gray-200 rounded-xl p-8 text-left shadow-sm hover:shadow-lg hover:border-[#1E3A5F] hover:bg-[#f0f4fa] hover:scale-105 transition-all duration-200 group flex items-center gap-4"
                            >
                                <span className="text-3xl">{mod.icon}</span>
                                <span className="text-[#1E3A5F] font-semibold text-base group-hover:text-[#1E3A5F]">
                                    {mod.label}
                                </span>
                            </button>
                        ))}
                </div>
            </main>

            <footer className="mt-16 py-4 text-center text-gray-400 text-xs border-t border-gray-200">
                Sistema Contable — Análisis de Sistemas
            </footer>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RutaProtegida><Home /></RutaProtegida>} />
                <Route path="/polizas" element={<RutaProtegida><Polizas /></RutaProtegida>} />
                <Route path="/cuentas" element={<RutaProtegida><CatalogoCuentas /></RutaProtegida>} />
                <Route path="/periodos" element={<RutaProtegida><Periodos /></RutaProtegida>} />
                <Route path="/reportes" element={<RutaProtegida><Reportes /></RutaProtegida>} />
                <Route path="/configuracion-reportes" element={<RutaProtegida><ConfiguracionReportes /></RutaProtegida>} />
                <Route path="/hoja-trabajo" element={<RutaProtegida><HojaTrabajoSaldos /></RutaProtegida>} />
                
                {/* Módulos críticos restringidos únicamente a administradores */}
                <Route path="/usuarios" element={
                    <RutaProtegida rolesPermitidos={['ADMIN']}><UsuariosContables /></RutaProtegida>
                } />
                <Route path="/logs" element={
                    <RutaProtegida rolesPermitidos={['ADMIN']}><LogsAuditoria /></RutaProtegida>
                } />
                
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
