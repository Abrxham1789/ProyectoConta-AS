import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import polizasDetalleService from '../services/polizasDetalleService';
import Toast from './Toast';

function PolizasDetalle() {
    const navigate = useNavigate();
    const [detalles, setDetalles] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [form, setForm] = useState({ POLIZA_ID: '', CUENTA_ID: '', DEBE: '', HABER: '' });
    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    const [formEditar, setFormEditar] = useState({ DETALLE_ID: '', POLIZA_ID: '', CUENTA_ID: '', DEBE: '', HABER: '' });

    useEffect(() => { cargarDetalles(); }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarDetalles = async () => {
        try {
            const res = await polizasDetalleService.getAll();
            setDetalles(res.data);
        } catch (err) { mostrarMensaje('Error al cargar detalles', 'error'); }
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleChangeEditar = (e) => setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    const handleCrear = async () => {
        try {
            await polizasDetalleService.create(form);
            mostrarMensaje('Detalle creado correctamente', 'exito');
            cargarDetalles();
        } catch (err) { mostrarMensaje('Error al crear detalle', 'error'); }
    };

    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminar = async () => {
        try {
            await polizasDetalleService.delete(modalEliminar.id);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Detalle eliminado correctamente', 'exito');
            cargarDetalles();
        } catch (err) { mostrarMensaje('Error al eliminar detalle', 'error'); }
    };

    const handleAbrirModal = (d) => {
        setFormEditar({ DETALLE_ID: d.DETALLE_ID, POLIZA_ID: d.POLIZA_ID, CUENTA_ID: d.CUENTA_ID, DEBE: d.DEBE, HABER: d.HABER });
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await polizasDetalleService.update(formEditar.DETALLE_ID, formEditar);
            setModalVisible(false);
            mostrarMensaje('Detalle actualizado correctamente', 'exito');
            cargarDetalles();
        } catch (err) { mostrarMensaje('Error al actualizar detalle', 'error'); }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Pólizas Detalle</h1>
                            <p className="text-blue-200 text-sm">Movimientos debe y haber</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-8 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nuevo Detalle</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div><label className={labelClass}>ID Póliza</label><input name="POLIZA_ID" className={inputClass} placeholder="Ej. 1" onChange={handleChange} /></div>
                        <div><label className={labelClass}>ID Cuenta</label><input name="CUENTA_ID" className={inputClass} placeholder="Ej. 101" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Debe</label><input name="DEBE" className={inputClass} placeholder="0.00" type="number" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Haber</label><input name="HABER" className={inputClass} placeholder="0.00" type="number" onChange={handleChange} /></div>
                    </div>
                    <div className="mt-5"><button onClick={handleCrear} className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">+ Crear Detalle</button></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[#1E3A5F] font-bold text-lg">Detalles Registrados</h2>
                        <p className="text-gray-400 text-sm">{detalles.length} registro(s) encontrado(s)</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID Póliza</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID Cuenta</th>
                                    <th className="px-4 py-3 text-left font-semibold">Nombre Cuenta</th>
                                    <th className="px-4 py-3 text-right font-semibold">Debe</th>
                                    <th className="px-4 py-3 text-right font-semibold">Haber</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalles.map((d, index) => (
                                    <tr key={d.DETALLE_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-mono text-gray-600">{d.DETALLE_ID}</td>
                                        <td className="px-4 py-3 text-gray-600">{d.POLIZA_ID}</td>
                                        <td className="px-4 py-3 text-gray-600">{d.CUENTA_ID}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{d.NOMBRE_CUENTA}</td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700">{d.DEBE}</td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700">{d.HABER}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleAbrirModal(d)} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all">Editar</button>
                                            <button onClick={() => confirmarEliminar(d.DETALLE_ID)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Eliminar</button>
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
                            <h3 className="font-bold text-lg">Editar Detalle</h3>
                            <button onClick={() => setModalVisible(false)} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>ID</label><p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">{formEditar.DETALLE_ID}</p></div>
                            <div><label className={labelClass}>ID Póliza</label><input name="POLIZA_ID" value={formEditar.POLIZA_ID} onChange={handleChangeEditar} className={inputClass} /></div>
                            <div><label className={labelClass}>ID Cuenta</label><input name="CUENTA_ID" value={formEditar.CUENTA_ID} onChange={handleChangeEditar} className={inputClass} /></div>
                            <div><label className={labelClass}>Debe</label><input name="DEBE" value={formEditar.DEBE} type="number" onChange={handleChangeEditar} className={inputClass} /></div>
                            <div><label className={labelClass}>Haber</label><input name="HABER" value={formEditar.HABER} type="number" onChange={handleChangeEditar} className={inputClass} /></div>
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

export default PolizasDetalle;