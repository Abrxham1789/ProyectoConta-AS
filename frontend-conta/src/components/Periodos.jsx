import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import periodosService from '../services/periodosService';
import Toast from './Toast';

function Periodos() {
    const navigate = useNavigate();
    const [periodos, setPeriodos] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [form, setForm] = useState({ ANIO: '', MES: '', ESTADO_CIERRE: 'ABIERTO', FECHA_CIERRE: '' });
    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, anio: null, mes: null });
    const [formEditar, setFormEditar] = useState({ ANIO: '', MES: '', ESTADO_CIERRE: '', FECHA_CIERRE: '' });

    useEffect(() => { cargarPeriodos(); }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarPeriodos = async () => {
        try {
            const res = await periodosService.getAll();
            setPeriodos(res.data);
        } catch (err) { mostrarMensaje('Error al cargar periodos', 'error'); }
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleChangeEditar = (e) => setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    const handleCrear = async () => {
        try {
            await periodosService.create(form);
            mostrarMensaje('Periodo creado correctamente', 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al crear periodo', 'error'); }
    };

    const confirmarEliminar = (anio, mes) => setModalEliminar({ visible: true, anio, mes });

    const handleEliminar = async () => {
        try {
            await periodosService.delete(modalEliminar.anio, modalEliminar.mes);
            setModalEliminar({ visible: false, anio: null, mes: null });
            mostrarMensaje('Periodo eliminado correctamente', 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al eliminar periodo', 'error'); }
    };

    const handleAbrirModal = (p) => {
        setFormEditar({ ANIO: p.ANIO, MES: p.MES, ESTADO_CIERRE: p.ESTADO_CIERRE, FECHA_CIERRE: p.FECHA_CIERRE || '' });
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await periodosService.update(formEditar.ANIO, formEditar.MES, formEditar);
            setModalVisible(false);
            mostrarMensaje('Periodo actualizado correctamente', 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al actualizar periodo', 'error'); }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📅</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Periodos de Cierre</h1>
                            <p className="text-blue-200 text-sm">Gestión de periodos contables</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-8 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nuevo Periodo</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div><label className={labelClass}>Año</label><input name="ANIO" className={inputClass} placeholder="Ej. 2025" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Mes</label><input name="MES" className={inputClass} placeholder="Ej. 1" onChange={handleChange} /></div>
                        <div>
                            <label className={labelClass}>Estado</label>
                            <select name="ESTADO_CIERRE" className={inputClass} onChange={handleChange}>
                                <option value="ABIERTO">ABIERTO</option>
                                <option value="CERRADO">CERRADO</option>
                            </select>
                        </div>
                        <div><label className={labelClass}>Fecha Cierre</label><input name="FECHA_CIERRE" className={inputClass} placeholder="YYYY-MM-DD" onChange={handleChange} /></div>
                    </div>
                    <div className="mt-5"><button onClick={handleCrear} className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">+ Crear Periodo</button></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[#1E3A5F] font-bold text-lg">Periodos Registrados</h2>
                        <p className="text-gray-400 text-sm">{periodos.length} registro(s) encontrado(s)</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    <th className="px-4 py-3 text-left font-semibold">Año</th>
                                    <th className="px-4 py-3 text-left font-semibold">Mes</th>
                                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                    <th className="px-4 py-3 text-left font-semibold">Fecha Cierre</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {periodos.map((p, index) => (
                                    <tr key={`${p.ANIO}-${p.MES}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-mono text-gray-600">{p.ANIO}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.MES}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.ESTADO_CIERRE === 'ABIERTO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.ESTADO_CIERRE}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{p.FECHA_CIERRE}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleAbrirModal(p)} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all">Editar</button>
                                            <button onClick={() => confirmarEliminar(p.ANIO, p.MES)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            {modalVisible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="bg-[#1E3A5F] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <h3 className="font-bold text-lg">Editar Periodo</h3>
                            <button onClick={() => setModalVisible(false)} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>Año</label><p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">{formEditar.ANIO}</p></div>
                            <div><label className={labelClass}>Mes</label><p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">{formEditar.MES}</p></div>
                            <div>
                                <label className={labelClass}>Estado</label>
                                <select name="ESTADO_CIERRE" value={formEditar.ESTADO_CIERRE} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="ABIERTO">ABIERTO</option>
                                    <option value="CERRADO">CERRADO</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Fecha Cierre</label><input name="FECHA_CIERRE" value={formEditar.FECHA_CIERRE} onChange={handleChangeEditar} className={inputClass} placeholder="YYYY-MM-DD" /></div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3 justify-end">
                            <button onClick={() => setModalVisible(false)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                            <button onClick={handleActualizar} className="px-5 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white text-sm font-semibold transition-all">Guardar cambios</button>
                        </div>
                    </div>
                </div>
            )}
            {modalEliminar.visible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
                        <div className="p-6 text-center">
                            <span className="text-5xl mb-4 block">⚠️</span>
                            <h3 className="text-gray-800 font-bold text-lg mb-2">¿Eliminar registro?</h3>
                            <p className="text-gray-500 text-sm mb-6">Esta acción no se puede deshacer.</p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setModalEliminar({ visible: false, anio: null, mes: null })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                                <button onClick={handleEliminar} className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all">Sí, eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Periodos;