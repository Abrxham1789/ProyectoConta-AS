import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cuentasService from '../services/cuentasService';
import Toast from './Toast';

// ══════════════════════════════════════════════════════════════════════
// MATRIZ DE COHERENCIA CONTABLE (espejo del backend)
// Al cambiar el RUBRO el sistema deriva automáticamente TIPO_SALDO,
// CLASIFICACION_HOJA (cuando es fija) y las opciones de SUB_RUBRO.
// ══════════════════════════════════════════════════════════════════════
const MATRIZ = {
    ACTIVO: {
        TIPO_SALDO:           'DEUDOR',
        CLASIFICACION_HOJA:   'BALANCE',      // fija — readOnly
        SUB_RUBROS:           ['CORRIENTE', 'NO CORRIENTE'],
        CLASIFICACION_LIBRE:  false,
    },
    PASIVO: {
        TIPO_SALDO:           'ACREEDOR',
        CLASIFICACION_HOJA:   'BALANCE',      // fija — readOnly
        SUB_RUBROS:           ['CORRIENTE', 'NO CORRIENTE', 'PATRIMONIO'],
        CLASIFICACION_LIBRE:  false,
    },
    PERDIDA: {
        TIPO_SALDO:           'DEUDOR',
        CLASIFICACION_HOJA:   null,           // el usuario elige dentro del set
        CLASIFICACIONES_HOJA: ['RESULTADOS', 'COSTO_PRODUCCION', 'COSTO_VENTAS'],
        SUB_RUBROS:           ['OPERATIVO'],  // único — readOnly
        CLASIFICACION_LIBRE:  true,
    },
    GANANCIA: {
        TIPO_SALDO:           'ACREEDOR',
        CLASIFICACION_HOJA:   'RESULTADOS',   // fija — readOnly
        SUB_RUBROS:           ['OPERATIVO'],  // único — readOnly
        CLASIFICACION_LIBRE:  false,
    },
};

const RUBROS = ['ACTIVO', 'PASIVO', 'PERDIDA', 'GANANCIA'];
const ESTADO_OPTS = ['ACTIVO', 'INACTIVO'];

// ── Estado vacío del formulario ────────────────────────────────────
const FORM_VACIO = {
    CUENTA_ID: '', NOMBRE: '', RUBRO: '',
    TIPO_SALDO: '', CLASIFICACION_HOJA: '', SUB_RUBRO: '', ESTADO: 'ACTIVO',
};

// ══════════════════════════════════════════════════════════════════════
// Hook: lógica de cascada contable
// Recibe el estado del formulario y devuelve los campos derivados
// ══════════════════════════════════════════════════════════════════════
function useCascadaContable(form, setForm) {
    const regla = MATRIZ[form.RUBRO] || null;

    // Cuando el RUBRO cambia, purga y recalcula los campos dependientes
    const aplicarCascada = (nuevoRubro) => {
        const r = MATRIZ[nuevoRubro];
        if (!r) {
            setForm((f) => ({ ...f, RUBRO: nuevoRubro, TIPO_SALDO: '', CLASIFICACION_HOJA: '', SUB_RUBRO: '' }));
            return;
        }
        setForm((f) => ({
            ...f,
            RUBRO:              nuevoRubro,
            TIPO_SALDO:         r.TIPO_SALDO,
            // Si CLASIFICACION_HOJA es fija, la asigna; si es libre, la limpia para que el usuario elija
            CLASIFICACION_HOJA: r.CLASIFICACION_LIBRE ? '' : r.CLASIFICACION_HOJA,
            // Si hay un único SUB_RUBRO posible, lo preselecciona; si no, limpia
            SUB_RUBRO:          r.SUB_RUBROS.length === 1 ? r.SUB_RUBROS[0] : '',
        }));
    };

    return { regla, aplicarCascada };
}

// ══════════════════════════════════════════════════════════════════════
// Componentes de presentación reutilizables
// ══════════════════════════════════════════════════════════════════════
const inputBase  = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-colors";
const inputNormal   = `${inputBase} border-gray-300 text-gray-700 bg-white`;
const inputReadOnly = `${inputBase} border-gray-200 text-gray-500 bg-gray-100 cursor-not-allowed`;
const labelClass    = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

function Label({ children, required }) {
    return (
        <label className={labelClass}>
            {children}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );
}

function ReadOnlyField({ label, value, hint }) {
    return (
        <div>
            <Label>{label}</Label>
            <div className="relative">
                <input readOnly value={value || '—'} className={inputReadOnly} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔒</span>
            </div>
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
    );
}

function SelectField({ label, name, value, onChange, opciones, placeholder = '-- Seleccionar --', required }) {
    return (
        <div>
            <Label required={required}>{label}</Label>
            <select name={name} value={value} onChange={onChange} className={inputNormal}>
                <option value="">{placeholder}</option>
                {opciones.map((op) => (
                    <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
                ))}
            </select>
        </div>
    );
}

// Nota contextual que aparece cuando el RUBRO es PASIVO
function NotaPatrimonio() {
    return (
        <div className="col-span-full bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-800">
            <span className="text-base mt-0.5">ℹ️</span>
            <span>
                <strong>Cuentas de Patrimonio / Capital:</strong> selecciona{' '}
                <strong>RUBRO = PASIVO</strong> y luego elige <strong>SUB RUBRO = PATRIMONIO</strong>.
                El Balance General las clasificará en esa sección automáticamente.
            </span>
        </div>
    );
}

// Panel que muestra los errores del backend en detalle
function PanelErrores({ errores, onCerrar }) {
    if (!errores || errores.length === 0) return null;
    return (
        <div className="col-span-full bg-red-50 border border-red-300 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-red-700 font-semibold text-xs uppercase tracking-wide">
                    ⛔ Errores de coherencia contable
                </span>
                <button onClick={onCerrar} className="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
            <ul className="space-y-1">
                {errores.map((e, i) => (
                    <li key={i} className="text-red-700 text-xs font-mono">{e}</li>
                ))}
            </ul>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
// Bloque de formulario con cascada
// Usado tanto en "Nueva Cuenta" como en el modal de edición
// ══════════════════════════════════════════════════════════════════════
function FormularioCuenta({ form, setForm, modoEdicion = false, erroresBackend, onLimpiarErrores }) {
    const { regla, aplicarCascada } = useCascadaContable(form, setForm);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'RUBRO') {
            aplicarCascada(value);         // ← cascada: purga y recalcula
        } else {
            setForm((f) => ({ ...f, [name]: value }));
        }
        if (onLimpiarErrores) onLimpiarErrores();
    };

    const tieneRubro = !!regla;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Errores del backend */}
            <PanelErrores errores={erroresBackend} onCerrar={onLimpiarErrores} />

            {/* Nota de Patrimonio solo cuando RUBRO = PASIVO */}
            {form.RUBRO === 'PASIVO' && <NotaPatrimonio />}

            {/* ID — solo en creación */}
            {!modoEdicion && (
                <div>
                    <Label required>ID de Cuenta</Label>
                    <input
                        name="CUENTA_ID"
                        value={form.CUENTA_ID}
                        onChange={handleChange}
                        className={inputNormal}
                        placeholder="Ej. 1010"
                    />
                </div>
            )}

            {/* Nombre */}
            <div className={modoEdicion ? '' : ''}>
                <Label required>Nombre</Label>
                <input
                    name="NOMBRE"
                    value={form.NOMBRE}
                    onChange={handleChange}
                    className={inputNormal}
                    placeholder="Ej. Caja General"
                />
            </div>

            {/* RUBRO — es el selector maestro que desencadena la cascada */}
            <SelectField
                label="Rubro"
                name="RUBRO"
                value={form.RUBRO}
                onChange={handleChange}
                opciones={RUBROS}
                required
            />

            {/* TIPO_SALDO — siempre readOnly, derivado del RUBRO */}
            <ReadOnlyField
                label="Tipo de Saldo"
                value={form.TIPO_SALDO}
                hint={tieneRubro ? 'Calculado automáticamente por el Rubro.' : undefined}
            />

            {/* CLASIFICACION_HOJA — readOnly EXCEPTO para PERDIDA */}
            {tieneRubro && regla.CLASIFICACION_LIBRE ? (
                <SelectField
                    label="Clasificación Hoja"
                    name="CLASIFICACION_HOJA"
                    value={form.CLASIFICACION_HOJA}
                    onChange={handleChange}
                    opciones={regla.CLASIFICACIONES_HOJA}
                    required
                />
            ) : (
                <ReadOnlyField
                    label="Clasificación Hoja"
                    value={form.CLASIFICACION_HOJA}
                    hint={tieneRubro ? 'Fija para este Rubro.' : undefined}
                />
            )}

            {/* SUB_RUBRO — opciones dependen del RUBRO; readOnly si solo hay 1 opción */}
            {tieneRubro && regla.SUB_RUBROS.length === 1 ? (
                <ReadOnlyField
                    label="Sub Rubro"
                    value={form.SUB_RUBRO}
                    hint="Único valor permitido para este Rubro."
                />
            ) : (
                <SelectField
                    label="Sub Rubro"
                    name="SUB_RUBRO"
                    value={form.SUB_RUBRO}
                    onChange={handleChange}
                    opciones={tieneRubro ? regla.SUB_RUBROS : []}
                    required
                />
            )}

            {/* ESTADO — solo en edición */}
            {modoEdicion && (
                <SelectField
                    label="Estado"
                    name="ESTADO"
                    value={form.ESTADO}
                    onChange={handleChange}
                    opciones={ESTADO_OPTS}
                />
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
function CatalogoCuentas() {
    const navigate    = useNavigate();
    const { usuario } = useAuth();

    const [cuentas,       setCuentas]       = useState([]);
    const [mensaje,       setMensaje]       = useState({ texto: '', tipo: '' });
    const [form,          setForm]          = useState(FORM_VACIO);
    const [formEditar,    setFormEditar]    = useState(FORM_VACIO);
    const [modalVisible,  setModalVisible]  = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    const [erroresCrear,  setErroresCrear]  = useState([]);
    const [erroresEditar, setErroresEditar] = useState([]);

    useEffect(() => { cargarCuentas(); }, []);

    // ── Helpers ──────────────────────────────────────────────────────
    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarCuentas = async () => {
        try {
            const res = await cuentasService.getAll();
            setCuentas(res.data);
        } catch {
            mostrarMensaje('Error al cargar cuentas', 'error');
        }
    };

    // ── Crear ─────────────────────────────────────────────────────────
    const handleCrear = async () => {
        setErroresCrear([]);
        try {
            await cuentasService.create(form, usuario.USER_ID);
            mostrarMensaje('Cuenta creada correctamente', 'exito');
            setForm(FORM_VACIO);
            cargarCuentas();
        } catch (err) {
            const data = err.response?.data;
            if (data?.errores) {
                setErroresCrear(data.errores);
            } else {
                mostrarMensaje(data?.message || 'Error al crear cuenta', 'error');
            }
        }
    };

    // ── Abrir modal de edición ────────────────────────────────────────
    // MECANISMO DE RESCATE: el modal se abre con los valores tal como
    // están en la BD (incluso si son corruptos). El usuario verá los
    // datos originales. Al cambiar el RUBRO, la cascada purga la basura
    // y fuerza los valores correctos de la Matriz, listos para el PUT.
    const handleAbrirModal = (cuenta) => {
        setErroresEditar([]);
        setFormEditar({ ...cuenta }); // valores de BD sin modificar
        setModalVisible(true);
    };

    // ── Actualizar ────────────────────────────────────────────────────
    const handleActualizar = async () => {
        setErroresEditar([]);
        try {
            await cuentasService.update(formEditar.CUENTA_ID, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Cuenta actualizada correctamente', 'exito');
            cargarCuentas();
        } catch (err) {
            const data = err.response?.data;
            if (data?.errores) {
                setErroresEditar(data.errores);
            } else {
                mostrarMensaje(data?.message || 'Error al actualizar cuenta', 'error');
            }
        }
    };

    // ── Eliminar ──────────────────────────────────────────────────────
    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminar = async () => {
        try {
            await cuentasService.delete(modalEliminar.id, usuario.USER_ID);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Cuenta eliminada correctamente', 'exito');
            cargarCuentas();
        } catch (err) {
            mostrarMensaje(err.response?.data?.message || 'Error al eliminar cuenta', 'error');
        }
    };

    // ── Badge de estado ───────────────────────────────────────────────
    const badgeEstado = (estado) =>
        estado === 'ACTIVO'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700';

    // ── Badge de coherencia (detecta registros corruptos en tabla) ────
    const esCoherente = (c) => {
        const regla = MATRIZ[c.RUBRO];
        if (!regla) return false;
        const tipoOk = c.TIPO_SALDO === regla.TIPO_SALDO;
        const claseOk = regla.CLASIFICACION_LIBRE
            ? regla.CLASIFICACIONES_HOJA.includes(c.CLASIFICACION_HOJA)
            : c.CLASIFICACION_HOJA === regla.CLASIFICACION_HOJA;
        const subOk = regla.SUB_RUBROS.includes(c.SUB_RUBRO);
        return tipoOk && claseOk && subOk;
    };

    // ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />

            {/* ── Header ── */}
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📒</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Catálogo de Cuentas</h1>
                            <p className="text-blue-200 text-sm">Gestión contable estandarizada</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                        ← Regresar
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">

                {/* ── Formulario Nueva Cuenta ── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">
                        Nueva Cuenta
                    </h2>
                    <FormularioCuenta
                        form={form}
                        setForm={setForm}
                        erroresBackend={erroresCrear}
                        onLimpiarErrores={() => setErroresCrear([])}
                    />
                    <div className="mt-5">
                        <button
                            onClick={handleCrear}
                            disabled={!form.RUBRO || !form.CUENTA_ID || !form.NOMBRE || !form.SUB_RUBRO || !form.CLASIFICACION_HOJA}
                            className="bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                        >
                            + Crear Cuenta
                        </button>
                    </div>
                </div>

                {/* ── Tabla ── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-[#1E3A5F] font-bold text-lg">Cuentas Registradas</h2>
                            <p className="text-gray-400 text-sm">{cuentas.length} registro(s)</p>
                        </div>
                        {cuentas.some((c) => !esCoherente(c)) && (
                            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                                ⚠️ Hay registros con inconsistencias — usa Editar para rescatarlos
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    {['ID','Nombre','Tipo Saldo','Clasificación','Rubro','Sub Rubro','Estado',''].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cuentas.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-gray-400">
                                            No hay cuentas registradas.
                                        </td>
                                    </tr>
                                ) : cuentas.map((cuenta, i) => {
                                    const corrupto = !esCoherente(cuenta);
                                    return (
                                        <tr
                                            key={cuenta.CUENTA_ID}
                                            className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${corrupto ? 'border-l-4 border-amber-400' : ''}`}
                                        >
                                            <td className="px-4 py-3 font-mono text-gray-600">{cuenta.CUENTA_ID}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {cuenta.NOMBRE}
                                                {corrupto && (
                                                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                                                        ⚠ Inconsistente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{cuenta.TIPO_SALDO}</td>
                                            <td className="px-4 py-3 text-gray-600">{cuenta.CLASIFICACION_HOJA?.replace(/_/g, ' ')}</td>
                                            <td className="px-4 py-3 text-gray-600">{cuenta.RUBRO}</td>
                                            <td className="px-4 py-3 text-gray-600">{cuenta.SUB_RUBRO}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeEstado(cuenta.ESTADO)}`}>
                                                    {cuenta.ESTADO}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => handleAbrirModal(cuenta)}
                                                    className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium mr-2 transition-all"
                                                >
                                                    {corrupto ? '🔧 Rescatar' : 'Editar'}
                                                </button>
                                                <button
                                                    onClick={() => confirmarEliminar(cuenta.CUENTA_ID)}
                                                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ── Modal Editar / Rescatar ── */}
            {modalVisible && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

                        <div className="bg-[#1E3A5F] text-white px-6 py-4 rounded-t-xl flex items-center justify-between sticky top-0 z-10">
                            <div>
                                <h3 className="font-bold text-lg">Editar Cuenta</h3>
                                <p className="text-blue-200 text-xs font-mono">{formEditar.CUENTA_ID}</p>
                            </div>
                            <button onClick={() => setModalVisible(false)} className="text-white/70 hover:text-white text-xl">✕</button>
                        </div>

                        {/* Aviso de rescate si el registro es corrupto */}
                        {!esCoherente(formEditar) && (
                            <div className="mx-6 mt-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-xs text-amber-800">
                                <strong>🔧 Modo Rescate activo:</strong> Este registro tiene inconsistencias contables.
                                Selecciona el <strong>Rubro correcto</strong> y el formulario recalculará
                                automáticamente los demás campos para normalizarlo.
                            </div>
                        )}

                        <div className="p-6">
                            <FormularioCuenta
                                form={formEditar}
                                setForm={setFormEditar}
                                modoEdicion
                                erroresBackend={erroresEditar}
                                onLimpiarErrores={() => setErroresEditar([])}
                            />
                        </div>

                        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                            <button
                                onClick={() => setModalVisible(false)}
                                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleActualizar}
                                disabled={!formEditar.RUBRO || !formEditar.NOMBRE || !formEditar.SUB_RUBRO || !formEditar.CLASIFICACION_HOJA}
                                className="px-5 py-2 rounded-lg bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Confirmar Eliminar ── */}
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