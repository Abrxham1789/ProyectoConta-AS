import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logsService from '../services/logsService';
import Toast from './Toast';

function LogsAuditoria() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [logsFiltrados, setLogsFiltrados] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [filtros, setFiltros] = useState({
        usuario: '',
        accion: '',
        tabla: '',
        fecha: ''
    });

    useEffect(() => { cargarLogs(); }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarLogs = async () => {
        try {
            const res = await logsService.getAll();
            setLogs(res.data);
            setLogsFiltrados(res.data);
        } catch (err) { mostrarMensaje('Error al cargar logs', 'error'); }
    };

    const handleFiltro = (e) => {
        const nuevosFiltros = { ...filtros, [e.target.name]: e.target.value };
        setFiltros(nuevosFiltros);

        const filtrado = logs.filter((l) => {
            const coincideUsuario = nuevosFiltros.usuario === '' ||
                (l.USERNAME && l.USERNAME.toLowerCase().includes(nuevosFiltros.usuario.toLowerCase()));
            const coincideAccion = nuevosFiltros.accion === '' || l.ACCION === nuevosFiltros.accion;
            const coincideTabla = nuevosFiltros.tabla === '' ||
                (l.TABLA_AFECTADA && l.TABLA_AFECTADA.toLowerCase().includes(nuevosFiltros.tabla.toLowerCase()));
            const coincideFecha = nuevosFiltros.fecha === '' ||
                (l.FECHA_HORA && l.FECHA_HORA.toString().includes(nuevosFiltros.fecha));

            return coincideUsuario && coincideAccion && coincideTabla && coincideFecha;
        });

        setLogsFiltrados(filtrado);
    };

    const limpiarFiltros = () => {
        setFiltros({ usuario: '', accion: '', tabla: '', fecha: '' });
        setLogsFiltrados(logs);
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔍</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Logs de Auditoría</h1>
                            <p className="text-blue-200 text-sm">Registro de acciones del sistema</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-8">

                {/* Filtros de búsqueda */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Filtros de Búsqueda</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className={labelClass}>Usuario</label>
                            <input
                                name="usuario"
                                value={filtros.usuario}
                                onChange={handleFiltro}
                                className={inputClass}
                                placeholder="Buscar por usuario"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Acción</label>
                            <select name="accion" value={filtros.accion} onChange={handleFiltro} className={inputClass}>
                                <option value="">Todas</option>
                                <option value="INSERT">INSERT</option>
                                <option value="UPDATE">UPDATE</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Tabla Afectada</label>
                            <input
                                name="tabla"
                                value={filtros.tabla}
                                onChange={handleFiltro}
                                className={inputClass}
                                placeholder="Buscar por tabla"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Fecha</label>
                            <input
                                name="fecha"
                                value={filtros.fecha}
                                onChange={handleFiltro}
                                className={inputClass}
                                placeholder="Ej. 2025-01"
                                type="text"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button
                            onClick={limpiarFiltros}
                            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-[#1E3A5F] font-bold text-lg">Logs Registrados</h2>
                            <p className="text-gray-400 text-sm">{logsFiltrados.length} registro(s) encontrado(s)</p>
                        </div>
                        <button
                            onClick={cargarLogs}
                            className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        >
                            🔄 Actualizar
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    <th className="px-4 py-3 text-left font-semibold">ID Log</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID Usuario</th>
                                    <th className="px-4 py-3 text-left font-semibold">Username</th>
                                    <th className="px-4 py-3 text-left font-semibold">Acción</th>
                                    <th className="px-4 py-3 text-left font-semibold">Tabla Afectada</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID Registro</th>
                                    <th className="px-4 py-3 text-left font-semibold">Fecha y Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logsFiltrados.map((l, index) => (
                                    <tr key={l.LOG_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-mono text-gray-600">{l.LOG_ID}</td>
                                        <td className="px-4 py-3 text-gray-600">{l.USER_ID}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{l.USERNAME}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                l.ACCION === 'INSERT' ? 'bg-green-100 text-green-700' :
                                                l.ACCION === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>{l.ACCION}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{l.TABLA_AFECTADA}</td>
                                        <td className="px-4 py-3 font-mono text-gray-600">{l.REGISTRO_ID}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{l.FECHA_HORA}</td>
                                    </tr>
                                ))}
                                {logsFiltrados.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                                            No se encontraron registros con los filtros aplicados
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default LogsAuditoria;