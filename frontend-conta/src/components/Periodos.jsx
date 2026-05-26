import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import periodosService from '../services/periodosService';
import Toast from './Toast';

function Periodos() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    
    // ── ESTADOS CONTABLES ORIGINALES COMBINADOS (UNA SOLA DECLARACIÓN) ──
    const [periodos, setPeriodos] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [form, setForm] = useState({ ANIO: '', MES: '', ESTADO_CIERRE: 'ABIERTO', FECHA_CIERRE: '' });
    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, anio: null, mes: null });
    const [formEditar, setFormEditar] = useState({ ANIO: '', MES: '', ESTADO_CIERRE: '', FECHA_CIERRE: '' });

    // ── NUEVOS ESTADOS DE BLINDAJE Y CONTROL UX ──
    const [modalReabrir, setModalReabrir] = useState({ visible: false, anio: null, mes: null, justificacion: '' });
    const [errores, setErrores] = useState({ ANIO: '', MES: '', FECHA_CIERRE: '', JUSTIFICACION: '' });
    const [touched, setTouched] = useState({ ANIO: false, MES: false, FECHA_CIERRE: false });

    // ── EVALUADORES DE ERROR CONTABLES MUTABLES ──
    function evaluarAnio(val, bloqueadoTeclado) {
        if (bloqueadoTeclado) return '⚠️ Acción no permitida: Solo se permiten números para registrar el año (Ej. 2025).';
        if (!val || val.trim() === '') return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
        if (val.length < 4) return '⚠️ El año está incompleto. Debe constar de exactamente 4 números.';
        if (/^(.)\1{3}$/.test(val)) return '⚠️ Error de coherencia: No se permite un año compuesto por un solo dígito repetido.';
        const n = parseInt(val, 10);
        if (n < 2000 || n > 2050) return '⚠️ Ejercicio inválido: Ingrese un año coherente para el período contable (2000 - 2050).';
        return '';
    }

    function evaluarMes(val, bloqueadoTeclado) {
        if (bloqueadoTeclado) return '⚠️ Acción no permitida: En el campo Mes solo se permiten números del 1 al 12.';
        if (!val || val.trim() === '') return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1 || n > 12) return '⚠️ Mes inválido: El mes debe estar estrictamente en el rango del 1 al 12 (Ej. 05).';
        return '';
    }

    function evaluarFechaCierre(val) {
        if (!val || val.trim() === '') return '⚠️ Campo requerido: Seleccione la fecha límite en el calendario contable.';
        return '';
    }

    function evaluarJustificacion(val) {
        if (!val || val.trim() === '') return '⚠️ Justificación obligatoria: Debe explicar por qué está reabriendo un período clausurado.';
        if (val.trim().length < 10) return '⚠️ Descripción muy corta: El motivo de auditoría debe tener al menos 10 caracteres.';
        if (/(.)\1{3,}/.test(val)) return '⚠️ Error de tipeo: Evite secuencias redundantes de letras repetidas sin sentido (Ej. "jjjj").';
        return '';
    }



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

        const handleChange = (e) => {
        const { name, value } = e.target;

        // ── CONTROL DE INGRESO: AÑO ──
        if (name === 'ANIO') {
            if (value !== '' && !/^\d*$/.test(value)) {
                setErrores(prev => ({ ...prev, ANIO: evaluarAnio('', true) }));
                return;
            }
            if (value.length > 4) return;
            setForm(prev => ({ ...prev, ANIO: value }));
            const msg = evaluarAnio(value, false);
            setErrores(prev => ({ ...prev, ANIO: (!msg || msg.includes('obligatorio')) ? (touched.ANIO ? msg : '') : msg }));
            return;
        }

        // ── CONTROL DE INGRESO: MES ──
        if (name === 'MES') {
            if (value !== '' && !/^\d*$/.test(value)) {
                setErrores(prev => ({ ...prev, MES: evaluarMes('', true) }));
                return;
            }
            if (value.length > 2) return;
            setForm(prev => ({ ...prev, MES: value }));
            const msg = evaluarMes(value, false);
            setErrores(prev => ({ ...prev, MES: (!msg || msg.includes('obligatorio')) ? (touched.MES ? msg : '') : msg }));
            return;
        }

        // ── CONTROL DE INGRESO: FECHA CIERRE (CALENDARIO) ──
        if (name === 'FECHA_CIERRE') {
            setForm(prev => ({ ...prev, FECHA_CIERRE: value }));
            setErrores(prev => ({ ...prev, FECHA_CIERRE: evaluarFechaCierre(value) }));
            return;
        }

        setForm({ ...form, [name]: value });
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        if (name === 'ANIO') setErrores(prev => ({ ...prev, ANIO: evaluarAnio(value, false) }));
        if (name === 'MES')  setErrores(prev => ({ ...prev, MES: evaluarMes(value, false) }));
        if (name === 'FECHA_CIERRE') setErrores(prev => ({ ...prev, FECHA_CIERRE: evaluarFechaCierre(value) }));
    };
        // ── MENSAJE DINÁMICO DE BLOQUEO DEL BOTÓN PERÍODO ──
    const guiaBloqueoPeriodo = useMemo(() => {
        const errAnio = evaluarAnio(form.ANIO, false);
        const errMes  = evaluarMes(form.MES, false, []);
        const errFec  = evaluarFechaCierre(form.FECHA_CIERRE);

        if (!form.ANIO || !form.MES || !form.FECHA_CIERRE) {
            return '📋 Completa todos los campos obligatorios para dar de alta el período.';
        }
        if (errAnio) return `📅 Campo Año incorrecto: ${errAnio.replace('⚠️ ', '')}`;
        if (errMes)  return `📆 Campo Mes incorrecto: ${errMes.replace('⚠️ ', '')}`;
        if (errFec)  return `📌 Campo Fecha incorrecto: ${errFec.replace('⚠️ ', '')}`;
        
        return '';
    }, [form, errores]);

    const botonCrearBloqueado = !!guiaBloqueoPeriodo;

    const handleChangeEditar = (e) => setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    const handleCrear = async () => {
        try {
            await periodosService.create(form, usuario.USER_ID);
            mostrarMensaje('Periodo creado correctamente', 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al crear periodo', 'error'); }
    };

    const confirmarEliminar = (anio, mes) => setModalEliminar({ visible: true, anio, mes });

    const handleEliminar = async () => {
        try {
            await periodosService.delete(modalEliminar.anio, modalEliminar.mes, usuario.USER_ID);
            setModalEliminar({ visible: false, anio: null, mes: null });
            mostrarMensaje('Periodo eliminado correctamente', 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al eliminar periodo', 'error'); }
    };

        const handleAbrirModal = (p) => {
        const fechaLimpia = p.FECHA_CIERRE ? String(p.FECHA_CIERRE).substring(0, 10) : '';
        
        setFormEditar({ 
            ANIO: p.ANIO, 
            MES: p.MES, 
            ESTADO_CIERRE: p.ESTADO_CIERRE, 
            FECHA_CIERRE: fechaLimpia 
        });
        setModalVisible(true);
    };


    const handleActualizar = async () => {
        try {
            await periodosService.update(formEditar.ANIO, formEditar.MES, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Periodo actualizado correctamente', 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al actualizar periodo', 'error'); }
    };

    const handleReabrir = async () => {
        try {
            await periodosService.update(modalReabrir.anio, modalReabrir.mes, { ESTADO_CIERRE: 'ABIERTO', FECHA_CIERRE: '' }, usuario.USER_ID);
            setModalReabrir({ visible: false, anio: null, mes: null });
            mostrarMensaje(`Periodo ${modalReabrir.mes}/${modalReabrir.anio} reabierto correctamente`, 'exito');
            cargarPeriodos();
        } catch (err) { mostrarMensaje('Error al reabrir el periodo', 'error'); }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

        // Helper para formatear las fechas ISO de Oracle Cloud a formato contable corto
    const formatearFechaCortadeOracle = (raw) => {
        if (!raw) return '—';
        const parte = String(raw).substring(0, 10);
        const [y, m, d] = parte.split('-');
        if (!y || !m || !d) return raw;
        return `${d}/${m}/${y}`;
    };

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
                                {/* ── RECIPROCO CORREGIDO: NUEVO PERIODO CON CALENDARIO Y EXCEPCIONES MUTABLES ── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nuevo Periodo</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* AÑO */}
                        <div>
                            <label className={labelClass}>Año</label>
                            <input 
                                name="ANIO" 
                                value={form.ANIO}
                                className={errores.ANIO ? "w-full border border-red-400 bg-red-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors" : inputClass} 
                                placeholder="Ej. 2025" 
                                onChange={handleChange} 
                                onBlur={handleBlur} 
                            />
                            {errores.ANIO && <p className="text-red-500 text-xs mt-1 leading-snug">{errores.ANIO}</p>}
                        </div>

                        {/* MES */}
                        <div>
                            <label className={labelClass}>Mes</label>
                            <input 
                                name="MES" 
                                value={form.MES}
                                className={errores.MES ? "w-full border border-red-400 bg-red-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors" : inputClass} 
                                placeholder="Ej. 1" 
                                onChange={handleChange} 
                                onBlur={handleBlur} 
                            />
                            {errores.MES && <p className="text-red-500 text-xs mt-1 leading-snug">{errores.MES}</p>}
                        </div>

                        {/* ESTADO */}
                        <div>
                            <label className={labelClass}>Estado</label>
                            <select name="ESTADO_CIERRE" value={form.ESTADO_CIERRE} className={inputClass} onChange={handleChange}>
                                <option value="ABIERTO">ABIERTO</option>
                                <option value="CERRADO">CERRADO</option>
                            </select>
                        </div>

                        {/* FECHA CIERRE (CALENDARIO INTERACTIVO) */}
                        <div>
                            <label className={labelClass}>Fecha Cierre</label>
                            {/* CAMBIO RADICAL: Se activa el DatePicker nativo con type="date" */}
                            <input 
                                name="FECHA_CIERRE" 
                                type="date" 
                                value={form.FECHA_CIERRE || ''} // ← Agregar el || '' aquí blinda el input
                                className={errores.FECHA_CIERRE ? "w-full border border-red-400 bg-red-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors" : inputClass} 
                                onChange={handleChange} 
                                onBlur={handleBlur} 
                            />
                            {errores.FECHA_CIERRE && <p className="text-red-500 text-xs mt-1 leading-snug">{errores.FECHA_CIERRE}</p>}
                        </div>
                    </div>

                                       {/* ── BOTÓN Y ASISTENTE DE BLOQUEO DE PERÍODOS ── */}
                    <div className="mt-5 flex flex-col gap-3">
                        <div>
                            <button 
                                onClick={handleCrear} 
                                disabled={botonCrearBloqueado} 
                                className="bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-45 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                            >
                                + Crear Periodo
                            </button>
                        </div>

                        {/* Tarjeta dinámica de Micro-UX que educa al usuario */}
                        {botonCrearBloqueado && guiaBloqueoPeriodo && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 max-w-xl animate-fadeIn">
                                <span className="text-amber-500 text-sm mt-0.5 shrink-0">🔒</span>
                                <div>
                                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Asistente de Ingreso</p>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed">{guiaBloqueoPeriodo}</p>
                                </div>
                            </div>
                        )}
                    </div>
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
                                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                            {formatearFechaCortadeOracle(p.FECHA_CIERRE)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-wrap gap-2 justify-center">
                                                {p.ESTADO_CIERRE === 'CERRADO' ? (
                                                    <button onClick={() => setModalReabrir({ visible: true, anio: p.ANIO, mes: p.MES })} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">🔓 Reabrir</button>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleAbrirModal(p)} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Editar</button>
                                                        <button onClick={() => confirmarEliminar(p.ANIO, p.MES)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Eliminar</button>
                                                    </>
                                                )}
                                            </div>
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
                                <div>
                                <label className={labelClass}>Fecha Cierre</label>
                                <input 
                                    name="FECHA_CIERRE" 
                                    type="date" 
                                    value={formEditar.FECHA_CIERRE} 
                                    onChange={handleChangeEditar} 
                                    className={inputClass} 
                                />
                            </div>

                        </div>
                        <div className="px-6 pb-6 flex gap-3 justify-end">
                            <button onClick={() => setModalVisible(false)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                            <button onClick={handleActualizar} className="px-5 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white text-sm font-semibold transition-all">Guardar cambios</button>
                        </div>
                    </div>
                </div>
            )}
                       {/* ── MODAL REABRIR NUEVO CON JUSTIFICACIÓN DE AUDITORÍA ── */}
            {modalReabrir.visible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
                            <h3 className="font-bold text-lg">⚠️ Autorizar Reapertura</h3>
                            <button onClick={() => setModalReabrir({ visible: false, anio: null, mes: null, justificacion: '' })} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-xs font-medium mb-4">
                                🚩 Advertencia: Reabrir el período **{modalReabrir.mes}/{modalReabrir.anio}** romperá el bloqueo de diarios en Oracle Cloud, permitiendo alteración de movimientos contables.
                            </div>
                            <div className="mb-5">
                                <label className={labelClass}>Justificación / Motivo de Auditoría</label>
                                <textarea
                                    rows="3"
                                    value={modalReabrir.justificacion}
                                    placeholder="Ej. Ajuste extraordinario solicitado por la gerencia financiera..."
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Bloqueo físico inmediato de símbolos, espacios dobles y letras redundantes
                                        if (val !== '' && !/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-\.\,]*$/.test(val)) return;
                                        if (/\s{2,}/.test(val)) return;
                                        if (/(.)\1{3,}/.test(val)) return;

                                        setModalReabrir(prev => ({ ...prev, justificacion: val }));
                                        setErrores(prev => ({ ...prev, JUSTIFICACION: evaluarJustificacion(val) }));
                                    }}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                />
                                {errores.JUSTIFICACION && <p className="text-red-500 text-xs mt-1 font-semibold">{errores.JUSTIFICACION}</p>}
                            </div>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setModalReabrir({ visible: false, anio: null, mes: null, justificacion: '' })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                                <button 
                                    onClick={handleReabrir} 
                                    disabled={!!evaluarJustificacion(modalReabrir.justificacion)}
                                    className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
                                >
                                    Sí, reabrir período
                                </button>
                            </div>
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