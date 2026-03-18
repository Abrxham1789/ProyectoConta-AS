import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cuentasService from '../services/cuentasService';
import Toast from './Toast';

function CatalogoCuentas() {
    const navigate = useNavigate();
    const [cuentas, setCuentas] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [form, setForm] = useState({
        CUENTA_ID: '', NOMBRE: '', TIPO_SALDO: '',
        CLASIFICACION_HOJA: '', RUBRO: '', SUB_RUBRO: '', ESTADO: 'ACTIVO'
    });
    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    const [formEditar, setFormEditar] = useState({
        CUENTA_ID: '', NOMBRE: '', TIPO_SALDO: '',
        CLASIFICACION_HOJA: '', RUBRO: '', SUB_RUBRO: '', ESTADO: ''
    });

    useEffect(() => { cargarCuentas(); }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarCuentas = async () => {
        try {
            const res = await cuentasService.getAll();
            setCuentas(res.data);
        } catch (err) { mostrarMensaje('Error al cargar cuentas', 'error'); }
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleChangeEditar = (e) => setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    const handleCrear = async () => {
        try {
            await cuentasService.create(form);
            mostrarMensaje('Cuenta creada correctamente', 'exito');
            cargarCuentas();
        } catch (err) { mostrarMensaje('Error al crear cuenta', 'error'); }
    };

    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminar = async () => {
        try {
            await cuentasService.delete(modalEliminar.id);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Cuenta eliminada correctamente', 'exito');
            cargarCuentas();
        } catch (err) { mostrarMensaje('Error al eliminar cuenta', 'error'); }
    };

    const handleAbrirModal = (cuenta) => {
        setFormEditar({ ...cuenta });
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await cuentasService.update(formEditar.CUENTA_ID, formEditar);
            setModalVisible(false);
            mostrarMensaje('Cuenta actualizada correctamente', 'exito');
            cargarCuentas();
        } catch (err) { mostrarMensaje('Error al actualizar cuenta', 'error'); }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />

            {/* Header */}
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📒</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Catálogo de Cuentas</h1>
                            <p className="text-blue-200 text-sm">Gestión de cuentas contables</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                        ← Regresar
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-8">

                {/* Formulario */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nueva Cuenta</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>ID</label>
                            <input name="CUENTA_ID" className={inputClass} placeholder="Ej. 101" onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>Nombre</label>
                            <input name="NOMBRE" className={inputClass} placeholder="Ej. Caja General" onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>Tipo Saldo</label>
                            <select name="TIPO_SALDO" className={inputClass} onChange={handleChange}>
                                <option value="">-- Seleccionar --</option>
                                <option value="DEUDOR">DEUDOR</option>
                                <option value="ACREEDOR">ACREEDOR</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Clasificación</label>
                            <select name="CLASIFICACION_HOJA" className={inputClass} onChange={handleChange}>
                                <option value="">-- Seleccionar --</option>
                                <option value="COSTO_PRODUCCION">COSTO PRODUCCIÓN</option>
                                <option value="COSTO_VENTAS">COSTO VENTAS</option>
                                <option value="RESULTADOS">RESULTADOS</option>
                                <option value="BALANCE">BALANCE</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Rubro</label>
                            <select name="RUBRO" className={inputClass} onChange={handleChange}>
                                <option value="">-- Seleccionar --</option>
                                <option value="ACTIVO">ACTIVO</option>
                                <option value="PASIVO">PASIVO</option>
                                <option value="PERDIDA">PÉRDIDA</option>
                                <option value="GANANCIA">GANANCIA</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Sub Rubro</label>
                            <input name="SUB_RUBRO" className={inputClass} placeholder="Ej. Corriente" onChange={handleChange} />
                        </div>
                    </div>
                    <div className="mt-5">
                        <button
                            onClick={handleCrear}
                            className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                        >
                            + Crear Cuenta
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[#1E3A5F] font-bold text-lg">Cuentas Registradas</h2>
                        <p className="text-gray-400 text-sm">{cuentas.length} registro(s) encontrado(s)</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                                    <th className="px-4 py-3 text-left font-semibold">Tipo Saldo</th>
                                    <th className="px-4 py-3 text-left font-semibold">Clasificación</th>
                                    <th className="px-4 py-3 text-left font-semibold">Rubro</th>
                                    <th className="px-4 py-3 text-left font-semibold">Sub Rubro</th>
                                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cuentas.map((cuenta, index) => (
                                    <tr key={cuenta.CUENTA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-mono text-gray-600">{cuenta.CUENTA_ID}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{cuenta.NOMBRE}</td>
                                        <td className="px-4 py-3 text-gray-600">{cuenta.TIPO_SALDO}</td>
                                        <td className="px-4 py-3 text-gray-600">{cuenta.CLASIFICACION_HOJA}</td>
                                        <td className="px-4 py-3 text-gray-600">{cuenta.RUBRO}</td>
                                        <td className="px-4 py-3 text-gray-600">{cuenta.SUB_RUBRO}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cuenta.ESTADO === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {cuenta.ESTADO}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleAbrirModal(cuenta)}
                                                className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => confirmarEliminar(cuenta.CUENTA_ID)}
                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Modal Editar */}
            {modalVisible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="bg-[#1E3A5F] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <h3 className="font-bold text-lg">Editar Cuenta</h3>
                            <button onClick={() => setModalVisible(false)} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>ID</label>
                                <p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">{formEditar.CUENTA_ID}</p>
                            </div>
                            <div>
                                <label className={labelClass}>Nombre</label>
                                <input name="NOMBRE" value={formEditar.NOMBRE} onChange={handleChangeEditar} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Tipo Saldo</label>
                                <select name="TIPO_SALDO" value={formEditar.TIPO_SALDO} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="DEUDOR">DEUDOR</option>
                                    <option value="ACREEDOR">ACREEDOR</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Clasificación</label>
                                <select name="CLASIFICACION_HOJA" value={formEditar.CLASIFICACION_HOJA} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="COSTO_PRODUCCION">COSTO PRODUCCIÓN</option>
                                    <option value="COSTO_VENTAS">COSTO VENTAS</option>
                                    <option value="RESULTADOS">RESULTADOS</option>
                                    <option value="BALANCE">BALANCE</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Rubro</label>
                                <select name="RUBRO" value={formEditar.RUBRO} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="ACTIVO">ACTIVO</option>
                                    <option value="PASIVO">PASIVO</option>
                                    <option value="PERDIDA">PÉRDIDA</option>
                                    <option value="GANANCIA">GANANCIA</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Sub Rubro</label>
                                <input name="SUB_RUBRO" value={formEditar.SUB_RUBRO} onChange={handleChangeEditar} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Estado</label>
                                <select name="ESTADO" value={formEditar.ESTADO} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="ACTIVO">ACTIVO</option>
                                    <option value="INACTIVO">INACTIVO</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3 justify-end">
                            <button onClick={() => setModalVisible(false)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleActualizar} className="px-5 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white text-sm font-semibold transition-all">
                                Guardar cambios
                            </button>
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
                            <h3 className="text-gray-800 font-bold text-lg mb-2">¿Eliminar registro?</h3>
                            <p className="text-gray-500 text-sm mb-6">Esta acción no se puede deshacer.</p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setModalEliminar({ visible: false, id: null })}
                                    className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleEliminar}
                                    className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all"
                                >
                                    Sí, eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CatalogoCuentas;