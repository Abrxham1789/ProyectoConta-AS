import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import polizasCabeceraService from '../services/polizasCabeceraService';
import Toast from './Toast';

function PolizasCabecera() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const [polizas, setPolizas] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [form, setForm] = useState({ ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '', TIPO_POLIZA: '', ESTADO: 'BORRADOR', SINOPSIS: '' });
    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    const [formEditar, setFormEditar] = useState({ POLIZA_ID: '', ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '', TIPO_POLIZA: '', ESTADO: '', SINOPSIS: '' });

    useEffect(() => { cargarPolizas(); }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarPolizas = async () => {
        try {
            const res = await polizasCabeceraService.getAll();
            setPolizas(res.data);
        } catch (err) { mostrarMensaje('Error al cargar polizas', 'error'); }
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleChangeEditar = (e) => setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    const handleCrear = async () => {
        try {
            await polizasCabeceraService.create(form, usuario.USER_ID);
            mostrarMensaje('Poliza creada correctamente', 'exito');
            cargarPolizas();
        } catch (err) { mostrarMensaje('Error al crear poliza', 'error'); }
    };

    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminar = async () => {
        try {
            await polizasCabeceraService.delete(modalEliminar.id, usuario.USER_ID);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Poliza eliminada correctamente', 'exito');
            cargarPolizas();
        } catch (err) { mostrarMensaje('Error al eliminar poliza', 'error'); }
    };

    const handleAbrirModal = (p) => {
        setFormEditar({ POLIZA_ID: p.POLIZA_ID, ANIO: p.ANIO, MES: p.MES, NUM_POLIZA: p.NUM_POLIZA, FECHA: p.FECHA || '', TIPO_POLIZA: p.TIPO_POLIZA, ESTADO: p.ESTADO, SINOPSIS: p.SINOPSIS || '' });
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await polizasCabeceraService.update(formEditar.POLIZA_ID, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Poliza actualizada correctamente', 'exito');
            cargarPolizas();
        } catch (err) { mostrarMensaje('Error al actualizar poliza', 'error'); }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📋</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Pólizas Cabecera</h1>
                            <p className="text-blue-200 text-sm">Gestión de pólizas contables</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-8 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nueva Póliza</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div><label className={labelClass}>Año</label><input name="ANIO" className={inputClass} placeholder="Ej. 2025" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Mes</label><input name="MES" className={inputClass} placeholder="Ej. 1" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Num. Póliza</label><input name="NUM_POLIZA" className={inputClass} placeholder="Ej. 1" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Fecha</label><input name="FECHA" className={inputClass} placeholder="YYYY-MM-DD" onChange={handleChange} /></div>
                        <div>
                            <label className={labelClass}>Tipo Póliza</label>
                            <select name="TIPO_POLIZA" className={inputClass} onChange={handleChange}>
                                <option value="">-- Seleccionar --</option>
                                <option value="APERTURA">APERTURA</option>
                                <option value="DIARIO">DIARIO</option>
                                <option value="AJUSTE">AJUSTE</option>
                                <option value="CIERRE">CIERRE</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Estado</label>
                            <select name="ESTADO" className={inputClass} onChange={handleChange}>
                                <option value="BORRADOR">BORRADOR</option>
                                <option value="AUTORIZADA">AUTORIZADA</option>
                                <option value="ANULADA">ANULADA</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3"><label className={labelClass}>Sinopsis</label><input name="SINOPSIS" className={inputClass} placeholder="Descripción de la póliza" onChange={handleChange} /></div>
                    </div>
                    <div className="mt-5"><button onClick={handleCrear} className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">+ Crear Póliza</button></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[#1E3A5F] font-bold text-lg">Pólizas Registradas</h2>
                        <p className="text-gray-400 text-sm">{polizas.length} registro(s) encontrado(s)</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                                    <th className="px-4 py-3 text-left font-semibold">Año</th>
                                    <th className="px-4 py-3 text-left font-semibold">Mes</th>
                                    <th className="px-4 py-3 text-left font-semibold">Num. Póliza</th>
                                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                    <th className="px-4 py-3 text-left font-semibold">Sinopsis</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {polizas.map((p, index) => (
                                    <tr key={p.POLIZA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-mono text-gray-600">{p.POLIZA_ID}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.ANIO}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.MES}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.NUM_POLIZA}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.FECHA}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.TIPO_POLIZA}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.ESTADO === 'AUTORIZADA' ? 'bg-green-100 text-green-700' : p.ESTADO === 'ANULADA' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.ESTADO}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{p.SINOPSIS}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleAbrirModal(p)} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all">Editar</button>
                                            <button onClick={() => confirmarEliminar(p.POLIZA_ID)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Eliminar</button>
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
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="bg-[#1E3A5F] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <h3 className="font-bold text-lg">Editar Póliza</h3>
                            <button onClick={() => setModalVisible(false)} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>ID</label><p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">{formEditar.POLIZA_ID}</p></div>
                            <div><label className={labelClass}>Num. Póliza</label><input name="NUM_POLIZA" value={formEditar.NUM_POLIZA} onChange={handleChangeEditar} className={inputClass} /></div>
                            <div><label className={labelClass}>Año</label><input name="ANIO" value={formEditar.ANIO} onChange={handleChangeEditar} className={inputClass} /></div>
                            <div><label className={labelClass}>Mes</label><input name="MES" value={formEditar.MES} onChange={handleChangeEditar} className={inputClass} /></div>
                            <div><label className={labelClass}>Fecha</label><input name="FECHA" value={formEditar.FECHA} onChange={handleChangeEditar} className={inputClass} placeholder="YYYY-MM-DD" /></div>
                            <div>
                                <label className={labelClass}>Tipo Póliza</label>
                                <select name="TIPO_POLIZA" value={formEditar.TIPO_POLIZA} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="APERTURA">APERTURA</option>
                                    <option value="DIARIO">DIARIO</option>
                                    <option value="AJUSTE">AJUSTE</option>
                                    <option value="CIERRE">CIERRE</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Estado</label>
                                <select name="ESTADO" value={formEditar.ESTADO} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="BORRADOR">BORRADOR</option>
                                    <option value="AUTORIZADA">AUTORIZADA</option>
                                    <option value="ANULADA">ANULADA</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Sinopsis</label><input name="SINOPSIS" value={formEditar.SINOPSIS} onChange={handleChangeEditar} className={inputClass} /></div>
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
                                <button onClick={() => setModalEliminar({ visible: false, id: null })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                                <button onClick={handleEliminar} className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all">Sí, eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PolizasCabecera;