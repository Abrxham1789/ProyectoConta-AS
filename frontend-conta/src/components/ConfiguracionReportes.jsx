import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import configuracionReportesService from '../services/configuracionReportesService';
import cuentasService from '../services/cuentasService'; // ← Catálogo real de Oracle
import Toast from './Toast';

// ── DICCIONARIOS DE ESTRUCTURAS FINANCIERAS PARA GUATEMALA ──
const REPORTES_DISPONIBLES = [
    { id: 'BALANCE_GENERAL',   label: 'Balance General 📊' },
    { id: 'ESTADO_RESULTADOS', label: 'Estado de Resultados 📈' }
];

const SECCIONES_REPORTE = {
    BALANCE_GENERAL: [
        { id: 'ACTIVO_CORRIENTE',    label: 'Activo Corriente' },
        { id: 'ACTIVO_NO_CORRIENTE', label: 'Activo No Corriente' },
        { id: 'PASIVO_CORRIENTE',    label: 'Pasivo Corriente' },
        { id: 'PASIVO_NO_CORRIENTE', label: 'Pasivo No Corriente' },
        { id: 'PATRIMONIO',          label: 'Patrimonio Neto' }
    ],
    ESTADO_RESULTADOS: [
        { id: 'INGRESOS_OPERATIVOS', label: 'Ingresos Operativos (Ventas)' },
        { id: 'COSTO_DE_VENTAS',     label: 'Costo de Ventas' },
        { id: 'GASTOS_DE_OPERACION', label: 'Gastos de Operación' },
        { id: 'OTROS_INGRESOS',      label: 'Otros Ingresos (Financieros)' },
        { id: 'OTROS_GASTOS',        label: 'Otros Gastos' }
    ]
};

function ConfiguracionReportes() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    
    // Estados principales
    const [configs, setConfigs] = useState([]);
    const [cuentas, setCuentas] = useState([]); // Tu catálogo de Oracle
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    
    // Formulario de Creación Superior
    const [form, setForm] = useState({ 
        CONFIG_ID: '', NOMBRE_REPORTE: '', SECCION: '', 
        CUENTA_ID: '', ORDEN: '', OPERACION: '' 
    });
    const [cuentaTexto, setCuentaTexto] = useState(''); // Estado para búsqueda visual
    const [dropdownAbierto, setDropdownAbierto] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    
    // Formulario de Edición en Modal
    const [formEditar, setFormEditar] = useState({ 
        CONFIG_ID: '', NOMBRE_REPORTE: '', SECCION: '', 
        CUENTA_ID: '', ORDEN: '', OPERACION: '' 
    });
    const [cuentaTextoEditar, setCuentaTextoEditar] = useState('');
    const [dropdownAbiertoEditar, setDropdownAbiertoEditar] = useState(false);

    // Estados de Validación en Tiempo Real
    const [errores, setErrores] = useState({ CONFIG_ID: '', ORDEN: '', CUENTA_ID: '' });
    const [touched, setTouched] = useState({ CONFIG_ID: false, ORDEN: false, CUENTA_ID: false });

        useEffect(() => { 
        cargarConfigs(); 
        cargarCuentas();
    }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarConfigs = async () => {
        try {
            const res = await configuracionReportesService.getAll();
            setConfigs(res.data);
        } catch (err) { mostrarMensaje('Error al cargar configuraciones', 'error'); }
    };

    const cargarCuentas = async () => {
        try {
            const res = await cuentasService.getAll();
            setCuentas(res.data);
        } catch { mostrarMensaje('Error al cargar catálogo de cuentas', 'error'); }
    };

    // ── EVALUADORES DE ERROR JERÁRQUICOS ──
    function evaluarConfigId(val, bloqueadoTeclado, existencias) {
        if (bloqueadoTeclado) return '⚠️ Acción no permitida: El ID de configuración debe ser numérico.';
        if (!val || val.trim() === '') return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
        const duplicado = existencias.some(c => String(c.CONFIG_ID) === String(val));
        if (duplicado) return `⚠️ Código duplicado: El ID ${val} ya fue registrado en el sistema.`;
        return '';
    }

    function evaluarOrden(val, bloqueadoTeclado) {
        if (bloqueadoTeclado) return '⚠️ Acción no permitida: El orden jerárquico solo acepta números enteros.';
        if (!val || val.trim() === '') return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
        return '';
    }

    function evaluarCuentaId(val) {
        if (!val || val.trim() === '') return '⚠️ Cuenta requerida: Debe seleccionar una cuenta del catálogo para el mapeo.';
        return '';
    }

    // ── CONTROLES DE ESCRITURA FLUIDOS CON INTERCEPCIÓN DE TECLADO ──
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'CONFIG_ID') {
            if (value !== '' && !/^\d*$/.test(value)) {
                setErrores(prev => ({ ...prev, CONFIG_ID: evaluarConfigId('', true, configs) }));
                return;
            }
            setForm(prev => ({ ...prev, CONFIG_ID: value }));
            const msg = evaluarConfigId(value, false, configs);
            setErrores(prev => ({ ...prev, CONFIG_ID: (!msg || msg.includes('obligatorio')) ? (touched.CONFIG_ID ? msg : '') : msg }));
            return;
        }

        if (name === 'ORDEN') {
            if (value !== '' && !/^\d*$/.test(value)) {
                setErrores(prev => ({ ...prev, ORDEN: evaluarOrden('', true) }));
                return;
            }
            setForm(prev => ({ ...prev, ORDEN: value }));
            const msg = evaluarOrden(value, false);
            setErrores(prev => ({ ...prev, ORDEN: (!msg || msg.includes('obligatorio')) ? (touched.ORDEN ? msg : '') : msg }));
            return;
        }

        if (name === 'NOMBRE_REPORTE') {
            setForm(prev => ({ ...prev, NOMBRE_REPORTE: value, SECCION: '' }));
            return;
        }

        setForm({ ...form, [name]: value });
    };

    const handleBlur = (name, value) => {
        setTouched(prev => ({ ...prev, [name]: true }));
        if (name === 'CONFIG_ID') setErrores(prev => ({ ...prev, CONFIG_ID: evaluarConfigId(value, false, configs) }));
        if (name === 'ORDEN')     setErrores(prev => ({ ...prev, ORDEN: evaluarOrden(value, false) }));
        if (name === 'CUENTA_ID') setErrores(prev => ({ ...prev, CUENTA_ID: evaluarCuentaId(value) }));
    };

    const handleChangeEditar = (e) => {
        const { name, value } = e.target;
        if (name === 'NOMBRE_REPORTE') {
            setFormEditar({ ...formEditar, NOMBRE_REPORTE: value, SECCION: '' });
        } else {
            setFormEditar({ ...formEditar, [name]: value });
        }
    };

    // ── FILTROS REACTIVOS DE BÚSQUEDA DEL CATÁLOGO CONTABLE ──
    const cuentasFiltradas = useMemo(() => {
        const b = cuentaTexto.toLowerCase();
        return cuentas.filter(c => 
            `${c.CUENTA_ID} ${c.NOMBRE}`.toLowerCase().includes(b) ||
            (c.NUM_REFERENCIA && String(c.NUM_REFERENCIA).includes(b))
        ).slice(0, 15);
    }, [cuentas, cuentaTexto]);

    const cuentasFiltradasEditar = useMemo(() => {
        const b = cuentaTextoEditar.toLowerCase();
        return cuentas.filter(c => 
            `${c.CUENTA_ID} ${c.NOMBRE}`.toLowerCase().includes(b) ||
            (c.NUM_REFERENCIA && String(c.NUM_REFERENCIA).includes(b))
        ).slice(0, 15);
    }, [cuentas, cuentaTextoEditar]);

    // Asistente dinámico de bloqueo unificado para las tarjetas
    const guiaBloqueoConfig = useMemo(() => {
        if (!form.CONFIG_ID || !form.NOMBRE_REPORTE || !form.SECCION || !form.CUENTA_ID || !form.ORDEN || !form.OPERACION) {
            return '📋 Complete todos los campos de la estructura de reporte (ID, Mapeo y Operación) para guardar.';
        }
        const errConfig = evaluarConfigId(form.CONFIG_ID, false, configs);
        const errOrd    = evaluarOrden(form.ORDEN, false);
        if (errConfig) return `🆔 Código de Configuración incorrecto: ${errConfig.replace('⚠️ ', '')}`;
        if (errOrd)    return `🔢 Jerarquía inválida: ${errOrd.replace('⚠️ ', '')}`;
        return '';
    }, [form, configs]);

    const botonBloqueado = !!guiaBloqueoConfig;

    const handleCrearConLimpieza = async () => {
        try {
            await configuracionReportesService.create(form, usuario.USER_ID);
            mostrarMensaje('Configuración creada correctamente', 'exito');
            setForm({ CONFIG_ID: '', NOMBRE_REPORTE: '', SECCION: '', CUENTA_ID: '', ORDEN: '', OPERACION: '' });
            setCuentaTexto('');
            setTouched({ CONFIG_ID: false, ORDEN: false, CUENTA_ID: false });
            setErrores({ CONFIG_ID: '', ORDEN: '', CUENTA_ID: '' });
            cargarConfigs();
        } catch (err) { mostrarMensaje('Error al crear configuración', 'error'); }
    };

    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminarConCarga = async () => {
        try {
            await configuracionReportesService.delete(modalEliminar.id, usuario.USER_ID);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Configuración eliminada correctamente', 'exito');
            cargarConfigs();
        } catch (err) { mostrarMensaje('Error al eliminar configuración', 'error'); }
    };

    const handleAbrirModalConTexto = (c) => {
        setFormEditar({ ...c });
        const cAsociada = cuentas.find(cta => String(cta.CUENTA_ID) === String(c.CUENTA_ID));
        setCuentaTextoEditar(cAsociada ? `${cAsociada.CUENTA_ID} — ${cAsociada.NOMBRE}` : c.CUENTA_ID);
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await configuracionReportesService.update(formEditar.CONFIG_ID, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Configuración actualizada correctamente', 'exito');
            cargarConfigs();
        } catch (err) { mostrarMensaje('Error al actualizar configuración', 'error'); }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-all";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";


    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚙️</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Configuración de Reportes</h1>
                            <p className="text-blue-200 text-sm">Estructura de estados financieros</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>
            
            <main className="max-w-7xl mx-auto px-8 py-8">
                {/* ── FORMULARIO SUPERIOR AUTOMATIZADO Y BLINDADO ── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Nueva Configuración</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        
                        {/* ID CONFIG */}
                        <div>
                            <label className={labelClass}>ID Config</label>
                            <input 
                                name="CONFIG_ID" 
                                value={form.CONFIG_ID}
                                className={errores.CONFIG_ID ? "w-full border border-red-400 bg-red-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors" : inputClass} 
                                placeholder="Ej. 1" 
                                onChange={handleChange}
                                onBlur={(e) => handleBlur('CONFIG_ID', e.target.value)}
                            />
                            {errores.CONFIG_ID && <p className="text-red-500 text-xs mt-1 leading-snug">{errores.CONFIG_ID}</p>}
                        </div>

                        {/* NOMBRE REPORTE (DROPDOWN CONTABLE CERRADO) */}
                        <div>
                            <label className={labelClass}>Nombre Reporte</label>
                            <select 
                                name="NOMBRE_REPORTE" 
                                value={form.NOMBRE_REPORTE}
                                className={inputClass}
                                onChange={handleChange}
                            >
                                <option value="">-- Seleccionar Reporte --</option>
                                {REPORTES_DISPONIBLES.map(r => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* SECCIÓN (DROPDOWN DINÁMICO CONDICIONADO POR EL REPORTE) */}
                        <div>
                            <label className={labelClass}>Sección</label>
                            <select 
                                name="SECCION" 
                                value={form.SECCION}
                                disabled={!form.NOMBRE_REPORTE}
                                className={`${inputClass} disabled:opacity-40 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                onChange={handleChange}
                            >
                                <option value="">-- Seleccionar Sección --</option>
                                {form.NOMBRE_REPORTE && SECCIONES_REPORTE[form.NOMBRE_REPORTE]?.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                                                {/* ID CUENTA (INYECTADO CON EL BUSCADOR EN TIEMPO REAL DEL CATÁLOGO) */}
                        <div className="relative">
                            <label className={labelClass}>ID Cuenta</label>
                            <input 
                                type="text"
                                placeholder="Buscar cuenta del catálogo..."
                                value={cuentaTexto}
                                className={errores.CUENTA_ID && touched.CUENTA_ID ? "w-full border border-red-400 bg-red-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none" : inputClass}
                                onChange={(e) => {
                                    setCuentaTexto(e.target.value);
                                    setForm(prev => ({ ...prev, CUENTA_ID: '' })); 
                                    setDropdownAbierto(true);
                                }}
                                onFocus={() => setDropdownAbierto(true)}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setDropdownAbierto(false);
                                        handleBlur('CUENTA_ID', form.CUENTA_ID);
                                    }, 250);
                                }}
                            />
                            {errores.CUENTA_ID && touched.CUENTA_ID && <p className="text-red-500 text-xs mt-1">{errores.CUENTA_ID}</p>}

                            {/* Dropdown flotante de sugerencias contables reales */}
                            {dropdownAbierto && (
                                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                    {cuentasFiltradas.map((c) => {
                                        const idL = String(c.CUENTA_ID || '').replace(/[- ]/g, '');
                                        const esBanco = (String(c.CUENTA_ID || '').startsWith('1-10') && idL.length === 5) || (String(c.CUENTA_ID || '').startsWith('110') && idL.length === 5);
                                        const tieneRef = c.NUM_REFERENCIA !== null && c.NUM_REFERENCIA !== undefined && String(c.NUM_REFERENCIA).trim() !== '';

                                        return (
                                            <div
                                                key={c.CUENTA_ID}
                                                onMouseDown={() => {
                                                    setForm(prev => ({ ...prev, CUENTA_ID: c.CUENTA_ID }));
                                                    setCuentaTexto(`${c.CUENTA_ID} — ${c.NOMBRE}`);
                                                    setDropdownAbierto(false);
                                                    setErrores(prev => ({ ...prev, CUENTA_ID: '' }));
                                                }}
                                                className="px-3 py-2 text-sm hover:bg-[#1E3A5F] hover:text-white cursor-pointer flex justify-between items-center group text-gray-700"
                                            >
                                                <span>{c.CUENTA_ID} — {c.NOMBRE}</span>
                                                {esBanco && tieneRef && (
                                                    <span className="font-mono text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded group-hover:bg-white/20 group-hover:text-white transition-colors">
                                                        🏦 Cta: {c.NUM_REFERENCIA}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {cuentasFiltradas.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-400 italic">Sin resultados contables</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ORDEN JERÁRQUICO */}
                        <div>
                            <label className={labelClass}>Orden</label>
                            <input 
                                name="ORDEN" 
                                value={form.ORDEN}
                                className={errores.ORDEN ? "w-full border border-red-400 bg-red-50 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors" : inputClass} 
                                placeholder="Ej. 1" 
                                onChange={handleChange}
                                onBlur={(e) => handleBlur('ORDEN', e.target.value)}
                            />
                            {errores.ORDEN && <p className="text-red-500 text-xs mt-1 leading-snug">{errores.ORDEN}</p>}
                        </div>

                        {/* OPERACIÓN CONTABLE */}
                        <div>
                            <label className={labelClass}>Operación</label>
                            <select name="OPERACION" value={form.OPERACION} className={inputClass} onChange={handleChange}>
                                <option value="">-- Seleccionar --</option>
                                <option value="+">+ Suma</option>
                                <option value="-">- Resta</option>
                            </select>
                        </div>
                    </div>

                    {/* Botón con Asistente Unificado Premium */}
                    <div className="mt-5 flex flex-col gap-3">
                        <div>
                            <button 
                                onClick={handleCrearConLimpieza} 
                                disabled={botonBloqueado} 
                                className="bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-45 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                            >
                                + Crear Configuración
                            </button>
                        </div>

                        {botonBloqueado && guiaBloqueoConfig && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 max-w-xl animate-fadeIn">
                                <span className="text-amber-500 text-sm mt-0.5 shrink-0">🔒</span>
                                <div>
                                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Asistente de Ingreso</p>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed">{guiaBloqueoConfig}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                                {/* ── LISTADO DE CONFIGURACIONES REGISTRADAS ── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[#1E3A5F] font-bold text-lg">Configuraciones Registradas</h2>
                        <p className="text-gray-400 text-sm">{configs.length} registro(s) encontrado(s)</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                                    <th className="px-4 py-3 text-left font-semibold">Nombre Reporte</th>
                                    <th className="px-4 py-3 text-left font-semibold">Sección</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID Cuenta</th>
                                    <th className="px-4 py-3 text-left font-semibold">Orden</th>
                                    <th className="px-4 py-3 text-left font-semibold">Operación</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map((c, index) => (
                                    <tr key={c.CONFIG_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-mono text-gray-600">{c.CONFIG_ID}</td>
                                        <td className="px-4 py-3 font-semibold text-gray-800">{c.NOMBRE_REPORTE?.replace(/_/g, ' ')}</td>
                                        <td className="px-4 py-3 text-gray-600 text-xs font-medium uppercase tracking-wider">{c.SECCION?.replace(/_/g, ' ')}</td>
                                        <td className="px-4 py-3 text-gray-600 font-mono">{c.CUENTA_ID}</td>
                                        <td className="px-4 py-3 text-gray-600">{c.ORDEN}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${c.OPERACION === '+' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.OPERACION === '+' ? 'SUMA (+)' : 'RESTA (-)'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleAbrirModalConTexto(c)} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all">Editar</button>
                                            <button onClick={() => confirmarEliminar(c.CONFIG_ID)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

                        {/* ── MODAL EDITAR COMPLETAMENTE AUTOMATIZADO CON DROPDOWNS Y BUSCADOR ── */}
            {modalVisible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="bg-[#1E3A5F] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <h3 className="font-bold text-lg">Editar Configuración</h3>
                            <button onClick={() => setModalVisible(false)} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>ID</label><p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">{formEditar.CONFIG_ID}</p></div>
                            
                            <div>
                                <label className={labelClass}>Nombre Reporte</label>
                                <select name="NOMBRE_REPORTE" value={formEditar.NOMBRE_REPORTE} onChange={handleChangeEditar} className={inputClass}>
                                    {REPORTES_DISPONIBLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                            </div>

                            <div className="col-span-2">
                                <label className={labelClass}>Sección</label>
                                <select name="SECCION" value={formEditar.SECCION} onChange={handleChangeEditar} className={inputClass}>
                                    {formEditar.NOMBRE_REPORTE && SECCIONES_REPORTE[formEditar.NOMBRE_REPORTE]?.map(s => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-2 relative">
                                <label className={labelClass}>Cuenta Asociada</label>
                                <input 
                                    type="text" 
                                    value={cuentaTextoEditar} 
                                    className={inputClass} 
                                    onChange={(e) => {
                                        setCuentaTextoEditar(e.target.value);
                                        setFormEditar(prev => ({ ...prev, CUENTA_ID: '' }));
                                        setDropdownAbiertoEditar(true);
                                    }}
                                    onFocus={() => setDropdownAbiertoEditar(true)}
                                    onBlur={() => setTimeout(() => setDropdownAbiertoEditar(false), 250)}
                                />
                                {dropdownAbiertoEditar && (
                                    <div className="absolute z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                                        {cuentasFiltradasEditar.map(c => (
                                            <div 
                                                key={c.CUENTA_ID}
                                                onMouseDown={() => {
                                                    setFormEditar(prev => ({ ...prev, CUENTA_ID: c.CUENTA_ID }));
                                                    setCuentaTextoEditar(`${c.CUENTA_ID} — ${c.NOMBRE}`);
                                                    setDropdownAbiertoEditar(false);
                                                }}
                                                className="px-3 py-1.5 text-xs hover:bg-[#1E3A5F] hover:text-white cursor-pointer"
                                            >
                                                {c.CUENTA_ID} — {c.NOMBRE}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div><label className={labelClass}>Orden</label><input name="ORDEN" value={formEditar.ORDEN} type="number" onChange={handleChangeEditar} className={inputClass} /></div>
                            <div>
                                <label className={labelClass}>Operación</label>
                                <select name="OPERACION" value={formEditar.OPERACION} onChange={handleChangeEditar} className={inputClass}>
                                    <option value="+">+ Suma</option>
                                    <option value="-">- Resta</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3 justify-end">
                            <button onClick={() => setModalVisible(false)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                            <button onClick={handleActualizar} disabled={!formEditar.CUENTA_ID} className="px-5 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-45 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all">Guardar cambios</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL ELIMINAR ── */}
            {modalEliminar.visible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
                        <div className="p-6 text-center">
                            <span className="text-5xl mb-4 block">⚠️</span>
                            <h3 className="text-gray-800 font-bold text-lg mb-2">¿Eliminar registro?</h3>
                            <p className="text-gray-500 text-sm mb-6">Esta acción no se puede deshacer.</p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setModalEliminar({ visible: false, id: null })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                                <button onClick={handleEliminarConCarga} className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all">Sí, eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ConfiguracionReportes;
