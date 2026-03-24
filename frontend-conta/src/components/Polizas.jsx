import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import polizasCabeceraService from '../services/polizasCabeceraService';
import polizasDetalleService from '../services/polizasDetalleService';
import cuentasService from '../services/cuentasService';
import Toast from './Toast';

function Polizas() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const [polizas, setPolizas] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    const [verDetalles, setVerDetalles] = useState({ visible: false, polizaId: null, detalles: [] });

    const [form, setForm] = useState({
        ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '',
        TIPO_POLIZA: '', ESTADO: 'BORRADOR', SINOPSIS: ''
    });

    const [detalles, setDetalles] = useState([
        { CUENTA_ID: '', DEBE: '', HABER: '' }
    ]);

    const [formEditar, setFormEditar] = useState({
        POLIZA_ID: '', ANIO: '', MES: '', NUM_POLIZA: '',
        FECHA: '', TIPO_POLIZA: '', ESTADO: '', SINOPSIS: ''
    });

    useEffect(() => {
        cargarPolizas();
        cargarCuentas();
    }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarPolizas = async () => {
        try {
            const res = await polizasCabeceraService.getAll();
            setPolizas(res.data);
        } catch (err) { mostrarMensaje('Error al cargar pólizas', 'error'); }
    };

    const cargarCuentas = async () => {
        try {
            const res = await cuentasService.getAll();
            setCuentas(res.data);
        } catch (err) { mostrarMensaje('Error al cargar cuentas', 'error'); }
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleChangeEditar = (e) => setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    const handleChangeDetalle = (index, e) => {
        const nuevosDetalles = [...detalles];
        nuevosDetalles[index][e.target.name] = e.target.value;
        setDetalles(nuevosDetalles);
    };

    const agregarLinea = () => {
        setDetalles([...detalles, { CUENTA_ID: '', DEBE: '', HABER: '' }]);
    };

    const eliminarLinea = (index) => {
        if (detalles.length === 1) return;
        setDetalles(detalles.filter((_, i) => i !== index));
    };

    const totalDebe = detalles.reduce((sum, d) => sum + (parseFloat(d.DEBE) || 0), 0);
    const totalHaber = detalles.reduce((sum, d) => sum + (parseFloat(d.HABER) || 0), 0);
    const cuadrada = totalDebe === totalHaber && totalDebe > 0;

    const handleCrear = async () => {
        if (!cuadrada) {
            mostrarMensaje('La póliza no cuadra. El total del Debe debe ser igual al total del Haber.', 'error');
            return;
        }
        try {
            await polizasCabeceraService.createUnificado({ ...form, DETALLES: detalles }, usuario.USER_ID);
            mostrarMensaje('Póliza creada correctamente', 'exito');
            setForm({ ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '', TIPO_POLIZA: '', ESTADO: 'BORRADOR', SINOPSIS: '' });
            setDetalles([{ CUENTA_ID: '', DEBE: '', HABER: '' }]);
            cargarPolizas();
        } catch (err) { mostrarMensaje('Error al crear póliza', 'error'); }
    };

    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminar = async () => {
        try {
            await polizasCabeceraService.delete(modalEliminar.id, usuario.USER_ID);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Póliza eliminada correctamente', 'exito');
            cargarPolizas();
        } catch (err) { mostrarMensaje('Error al eliminar póliza', 'error'); }
    };

    const handleAbrirModal = (p) => {
        setFormEditar({ POLIZA_ID: p.POLIZA_ID, ANIO: p.ANIO, MES: p.MES, NUM_POLIZA: p.NUM_POLIZA, FECHA: p.FECHA || '', TIPO_POLIZA: p.TIPO_POLIZA, ESTADO: p.ESTADO, SINOPSIS: p.SINOPSIS || '' });
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await polizasCabeceraService.update(formEditar.POLIZA_ID, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Póliza actualizada correctamente', 'exito');
            cargarPolizas();
        } catch (err) { mostrarMensaje('Error al actualizar póliza', 'error'); }
    };

    const verDetallesPoliza = async (polizaId) => {
        try {
            const res = await polizasDetalleService.getByPoliza(polizaId);
            setVerDetalles({ visible: true, polizaId, detalles: res.data });
        } catch (err) { mostrarMensaje('Error al cargar detalles', 'error'); }
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
                            <h1 className="text-2xl font-bold tracking-wide">Pólizas Contables</h1>
                            <p className="text-blue-200 text-sm">Registro de pólizas y partidas de diario</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-8">

                {/* Formulario cabecera */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nueva Póliza</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div><label className={labelClass}>Año</label><input name="ANIO" value={form.ANIO} className={inputClass} placeholder="Ej. 2025" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Mes</label><input name="MES" value={form.MES} className={inputClass} placeholder="Ej. 1" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Num. Póliza</label><input name="NUM_POLIZA" value={form.NUM_POLIZA} className={inputClass} placeholder="Ej. 1" onChange={handleChange} /></div>
                        <div><label className={labelClass}>Fecha</label><input name="FECHA" value={form.FECHA} className={inputClass} placeholder="YYYY-MM-DD" onChange={handleChange} /></div>
                        <div>
                            <label className={labelClass}>Tipo Póliza</label>
                            <select name="TIPO_POLIZA" value={form.TIPO_POLIZA} className={inputClass} onChange={handleChange}>
                                <option value="">-- Seleccionar --</option>
                                <option value="APERTURA">APERTURA</option>
                                <option value="DIARIO">DIARIO</option>
                                <option value="AJUSTE">AJUSTE</option>
                                <option value="CIERRE">CIERRE</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Estado</label>
                            <select name="ESTADO" value={form.ESTADO} className={inputClass} onChange={handleChange}>
                                <option value="BORRADOR">BORRADOR</option>
                                <option value="AUTORIZADA">AUTORIZADA</option>
                                <option value="ANULADA">ANULADA</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <label className={labelClass}>Sinopsis</label>
                            <input name="SINOPSIS" value={form.SINOPSIS} className={inputClass} placeholder="Descripción de la póliza" onChange={handleChange} />
                        </div>
                    </div>

                    {/* Líneas de detalle */}
                    <div className="mt-6">
                        <h3 className="text-[#1E3A5F] font-semibold text-base mb-3 pb-2 border-b border-gray-100">Líneas de Detalle</h3>
                        <div className="space-y-3">
                            {detalles.map((detalle, index) => (
                                <div key={index} className="grid grid-cols-12 gap-3 items-end">
                                    <div className="col-span-6">
                                        {index === 0 && <label className={labelClass}>Cuenta</label>}
                                        <select name="CUENTA_ID" value={detalle.CUENTA_ID} onChange={(e) => handleChangeDetalle(index, e)} className={inputClass}>
                                            <option value="">-- Seleccionar cuenta --</option>
                                            {cuentas.map((c) => (
                                                <option key={c.CUENTA_ID} value={c.CUENTA_ID}>{c.CUENTA_ID} — {c.NOMBRE}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        {index === 0 && <label className={labelClass}>Debe</label>}
                                        <input name="DEBE" value={detalle.DEBE} type="number" onChange={(e) => handleChangeDetalle(index, e)} className={inputClass} placeholder="0.00" />
                                    </div>
                                    <div className="col-span-2">
                                        {index === 0 && <label className={labelClass}>Haber</label>}
                                        <input name="HABER" value={detalle.HABER} type="number" onChange={(e) => handleChangeDetalle(index, e)} className={inputClass} placeholder="0.00" />
                                    </div>
                                    <div className="col-span-2 flex gap-2">
                                        {index === detalles.length - 1 && (
                                            <button onClick={agregarLinea} className="w-full bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-2 py-2 rounded-lg text-xs font-medium transition-all">
                                                + Línea
                                            </button>
                                        )}
                                        {detalles.length > 1 && (
                                            <button onClick={() => eliminarLinea(index)} className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-2 rounded-lg text-xs font-medium transition-all">
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Totales */}
                        <div className="mt-4 p-4 rounded-lg border flex items-center justify-between" style={{ borderColor: cuadrada ? '#16a34a' : totalDebe > 0 || totalHaber > 0 ? '#dc2626' : '#e5e7eb', backgroundColor: cuadrada ? '#f0fdf4' : totalDebe > 0 || totalHaber > 0 ? '#fef2f2' : '#f9fafb' }}>
                            <div className="flex gap-8">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Debe</p>
                                    <p className="text-lg font-bold text-gray-800">{totalDebe.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Haber</p>
                                    <p className="text-lg font-bold text-gray-800">{totalHaber.toFixed(2)}</p>
                                </div>
                            </div>
                            <div>
                                {cuadrada ? (
                                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">✅ Póliza cuadrada</span>
                                ) : totalDebe > 0 || totalHaber > 0 ? (
                                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">❌ Póliza descuadrada</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5">
                        <button
                            onClick={handleCrear}
                            disabled={!cuadrada}
                            className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            + Crear Póliza
                        </button>
                    </div>
                </div>

                {/* Tabla de pólizas */}
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
                                            <button onClick={() => verDetallesPoliza(p.POLIZA_ID)} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all">Ver</button>
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

            {/* Modal Ver Detalles */}
            {verDetalles.visible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
                        <div className="bg-[#1E3A5F] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <h3 className="font-bold text-lg">Detalles de Póliza #{verDetalles.polizaId}</h3>
                            <button onClick={() => setVerDetalles({ visible: false, polizaId: null, detalles: [] })} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-4 py-2 text-left font-semibold text-gray-600">ID</th>
                                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Nombre Cuenta</th>
                                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Debe</th>
                                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Haber</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {verDetalles.detalles.map((d, index) => (
                                        <tr key={d.DETALLE_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-2 font-mono text-gray-600">{d.DETALLE_ID}</td>
                                            <td className="px-4 py-2 text-gray-600">{d.CUENTA_ID}</td>
                                            <td className="px-4 py-2 font-medium text-gray-800">{d.NOMBRE_CUENTA}</td>
                                            <td className="px-4 py-2 text-right font-mono text-gray-700">{d.DEBE}</td>
                                            <td className="px-4 py-2 text-right font-mono text-gray-700">{d.HABER}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#1E3A5F] text-white">
                                        <td colSpan="3" className="px-4 py-2 font-semibold">Totales</td>
                                        <td className="px-4 py-2 text-right font-bold">
                                            {verDetalles.detalles.reduce((sum, d) => sum + (parseFloat(d.DEBE) || 0), 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold">
                                            {verDetalles.detalles.reduce((sum, d) => sum + (parseFloat(d.HABER) || 0), 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="px-6 pb-6 flex justify-end">
                            <button onClick={() => setVerDetalles({ visible: false, polizaId: null, detalles: [] })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editar */}
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

            {/* Modal Confirmar Eliminar */}
            {modalEliminar.visible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
                        <div className="p-6 text-center">
                            <span className="text-5xl mb-4 block">⚠️</span>
                            <h3 className="text-gray-800 font-bold text-lg mb-2">¿Eliminar póliza?</h3>
                            <p className="text-gray-500 text-sm mb-6">Se eliminarán también todos sus detalles. Esta acción no se puede deshacer.</p>
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

export default Polizas;