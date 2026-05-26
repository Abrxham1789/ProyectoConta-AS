import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import cuentasService from '../services/cuentasService';
import Toast from './Toast';

// ══════════════════════════════════════════════════════════════════════
// MATRIZ DE COHERENCIA CONTABLE (espejo del backend)
// ══════════════════════════════════════════════════════════════════════
const MATRIZ = {
    ACTIVO: {
        TIPO_SALDO:           'DEUDOR',
        CLASIFICACION_HOJA:   'BALANCE',
        SUB_RUBROS:           ['CORRIENTE', 'NO CORRIENTE'],
        CLASIFICACION_LIBRE:  false,
    },
    PASIVO: {
        TIPO_SALDO:           'ACREEDOR',
        CLASIFICACION_HOJA:   'BALANCE',
        SUB_RUBROS:           ['CORRIENTE', 'NO CORRIENTE', 'PATRIMONIO'],
        CLASIFICACION_LIBRE:  false,
    },
    PERDIDA: {
        TIPO_SALDO:           'DEUDOR',
        CLASIFICACION_HOJA:   null,
        CLASIFICACIONES_HOJA: ['RESULTADOS', 'COSTO_PRODUCCION', 'COSTO_VENTAS'],
        SUB_RUBROS:           ['OPERATIVO'],
        CLASIFICACION_LIBRE:  true,
    },
    GANANCIA: {
        TIPO_SALDO:           'ACREEDOR',
        CLASIFICACION_HOJA:   'RESULTADOS',
        SUB_RUBROS:           ['OPERATIVO'],
        CLASIFICACION_LIBRE:  false,
    },
};

const RUBROS      = ['ACTIVO', 'PASIVO', 'PERDIDA', 'GANANCIA'];
const ESTADO_OPTS = ['ACTIVO', 'INACTIVO'];

// ══════════════════════════════════════════════════════════════════════
// REQ 2 — Mapa de automatización por primer dígito del CUENTA_ID
// Cada entrada define qué campos se autofijan y cuáles quedan libres.
// ══════════════════════════════════════════════════════════════════════
const AUTOMATIZACION_DIGITO = {
    '1': {
        RUBRO:              'ACTIVO',
        TIPO_SALDO:         'DEUDOR',
        CLASIFICACION_HOJA: 'BALANCE',
        SUB_RUBRO:          '',          // libre: CORRIENTE / NO CORRIENTE
        CAMPOS_LIBRES:      ['SUB_RUBRO'],
        OPCIONES_SUB:       ['CORRIENTE', 'NO CORRIENTE'],
        OPCIONES_CLASE:     [],
    },
    '2': {
        RUBRO:              'PASIVO',
        TIPO_SALDO:         'ACREEDOR',
        CLASIFICACION_HOJA: 'BALANCE',
        SUB_RUBRO:          '',          // libre: CORRIENTE / NO CORRIENTE / PATRIMONIO
        CAMPOS_LIBRES:      ['SUB_RUBRO'],
        OPCIONES_SUB:       ['CORRIENTE', 'NO CORRIENTE', 'PATRIMONIO'],
        OPCIONES_CLASE:     [],
    },
    '3': {
        RUBRO:              'PASIVO',
        TIPO_SALDO:         'ACREEDOR',
        CLASIFICACION_HOJA: 'BALANCE',
        SUB_RUBRO:          '',
        CAMPOS_LIBRES:      ['SUB_RUBRO'],
        OPCIONES_SUB:       ['CORRIENTE', 'NO CORRIENTE', 'PATRIMONIO'],
        OPCIONES_CLASE:     [],
    },
    '4': {
        RUBRO:              'GANANCIA',
        TIPO_SALDO:         'ACREEDOR',
        CLASIFICACION_HOJA: 'RESULTADOS',
        SUB_RUBRO:          'OPERATIVO',
        CAMPOS_LIBRES:      [],           // todo bloqueado
        OPCIONES_SUB:       [],
        OPCIONES_CLASE:     [],
    },
    '5': {
        RUBRO:              'PERDIDA',
        TIPO_SALDO:         'DEUDOR',
        CLASIFICACION_HOJA: '',           // libre: COSTO_VENTAS / COSTO_PRODUCCION
        SUB_RUBRO:          'OPERATIVO',
        CAMPOS_LIBRES:      ['CLASIFICACION_HOJA'],
        OPCIONES_SUB:       [],
        OPCIONES_CLASE:     ['COSTO_VENTAS', 'COSTO_PRODUCCION'],
    },
    '6': {
        RUBRO:              'PERDIDA',
        TIPO_SALDO:         'DEUDOR',
        CLASIFICACION_HOJA: 'RESULTADOS',
        SUB_RUBRO:          'OPERATIVO',
        CAMPOS_LIBRES:      [],           // todo bloqueado
        OPCIONES_SUB:       [],
        OPCIONES_CLASE:     [],
    },
};

// ══════════════════════════════════════════════════════════════════════
// REQ 3 — Categorías del buscador (incluye nivel 6)
// ══════════════════════════════════════════════════════════════════════
const CATEGORIAS_FILTRO = [
    { label: 'Todos',       prefijo: '' },
    { label: 'Activos',     prefijo: '1' },
    { label: 'Pasivos',     prefijo: '2' },
    { label: 'Patrimonio',  prefijo: '3' },
    { label: 'Ingresos',    prefijo: '4' },
    { label: 'Gastos',      prefijo: '5' },
    { label: 'Gastos Op.',  prefijo: '6' },  // REQ 4 — nuevo filtro nivel 6
    { label: 'Cuentas Bancarias 🏦', prefijo: 'BANCOS' }
];

// REQ 5 — Mapa de nombres por primer dígito
const NOMBRES_NIVEL1 = {
    '1': 'Activo',
    '2': 'Pasivo',
    '3': 'Patrimonio',
    '4': 'Ingresos',
    '5': 'Gastos / Pérdidas',
    '6': 'Costos',
};

// ──────────────────────────────────────────────
// Estado vacío del formulario

const FORM_VACIO = {
    CUENTA_ID: '', NOMBRE: '', RUBRO: '',
    TIPO_SALDO: '', CLASIFICACION_HOJA: '', SUB_RUBRO: '', ESTADO: 'ACTIVO',
    NUM_REFERENCIA: '', // ← NUEVO: Estado inicial para la referencia de bancos
};

const ALERTAS_VACIAS = {
    CUENTA_ID: '', NOMBRE: '', RUBRO: '', SUB_RUBRO: '', CLASIFICACION_HOJA: '',
    NUM_REFERENCIA: '',
};

// ══════════════════════════════════════════════════════════════════════
// REQ 1 — Utilidades de validación del CUENTA_ID
// ══════════════════════════════════════════════════════════════════════
const REGEX_ID_VALIDO = /^(?!^-+$)[0-9]+(-[0-9]+)*$/;

function motivoIDInvalido(id) {
    if (!id || id.trim() === '')  return 'El ID de la cuenta está vacío.';
    if (/^-+$/.test(id))          return 'El ID no puede ser solo guiones.';
    if (id.includes('--'))        return 'El ID no puede tener guiones consecutivos (ej: 1--01).';
    if (id.startsWith('-'))       return 'El ID no puede comenzar con guión.';
    if (id.endsWith('-'))         return 'El ID no puede terminar en guión.';
    if (!REGEX_ID_VALIDO.test(id))return 'El ID debe contener solo números y guiones intermedios (ej: 1-10-01 o 1101).';
    return null;
}

// ══════════════════════════════════════════════════════════════════════
// Estilos reutilizables
// ══════════════════════════════════════════════════════════════════════
const inputBase     = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-colors";
const inputNormal   = `${inputBase} border-gray-300 text-gray-700 bg-white`;
const inputError    = `${inputBase} border-red-500 bg-red-50 ring-2 ring-red-100`;
const inputReadOnly = `${inputBase} border-gray-200 text-gray-500 bg-gray-100 cursor-not-allowed`;
const labelClass    = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

// ══════════════════════════════════════════════════════════════════════
// Componentes de presentación
// ══════════════════════════════════════════════════════════════════════
function Label({ children, required }) {
    return (
        <label className={labelClass}>
            {children}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );
}

function FieldAlerta({ mensaje }) {
    if (!mensaje) return null;
    return (
        <p className="text-red-600 text-xs font-medium mt-1 bg-red-100/50 p-1.5 rounded border border-red-200">
            {mensaje}
        </p>
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

function SelectField({ label, name, value, onChange, opciones, placeholder = '-- Seleccionar --', required, disabled }) {
    return (
        <div>
            <Label required={required}>{label}</Label>
            {disabled ? (
                <div className="relative">
                    <input readOnly value={value || '—'} className={inputReadOnly} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔒</span>
                </div>
            ) : (
                <select name={name} value={value} onChange={onChange} className={inputNormal}>
                    <option value="">{placeholder}</option>
                    {opciones.map((op) => (
                        <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            )}
        </div>
    );
}

function NotaPatrimonio() {
    return (
        <div className="col-span-full bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-800">
            <span className="text-base mt-0.5">ℹ️</span>
            <span>
                <strong>Cuentas de Patrimonio / Capital:</strong> el sistema asigna{' '}
                <strong>RUBRO = PASIVO</strong> automáticamente. Selecciona{' '}
                <strong>SUB RUBRO = PATRIMONIO</strong> para clasificarla correctamente.
            </span>
        </div>
    );
}

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
// REQ 5 — Componente de Desglose Horizontal (Breadcrumb Contable)
// ══════════════════════════════════════════════════════════════════════
const COLORES_NIVEL = [
    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   },
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', },
    { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   },
];

function DesgloseHorizontal({ cuentaId, nombre }) {
    const id = String(cuentaId || '').replace(/[- ]/g, '');
    if (id.length < 1) return null;

    const nivel1 = id.slice(0, 1);
    const nivel2 = id.slice(1, 3) || null;
    const nivel3 = id.slice(3)    || null;

    const niveles = [
        { etiqueta: 'Nivel 1: Clase',       codigo: nivel1, nombre: NOMBRES_NIVEL1[nivel1] || 'Clase' },
        nivel2 ? { etiqueta: 'Nivel 2: Grupo',        codigo: nivel2, nombre: `Grupo ${nivel2}` }    : null,
        nivel3 ? { etiqueta: 'Nivel 3: Cuenta Mayor', codigo: nivel3, nombre: nombre.trim() ? nombre.toUpperCase() : 'Cuenta Detalle' } : null,
    ].filter(Boolean);

    return (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estructura del código</p>
            <div className="flex items-center flex-wrap gap-1">
                {niveles.map((nivel, idx) => {
                    const c = COLORES_NIVEL[idx] || COLORES_NIVEL[2];
                    return (
                        <div key={idx} className="flex items-center gap-1">
                            <div className={`${c.bg} ${c.border} border rounded-lg px-3 py-1.5 text-center min-w-[90px]`}>
                                <p className={`text-xs font-semibold ${c.text} whitespace-nowrap`}>{nivel.etiqueta}</p>
                                <p className="font-mono font-bold text-gray-800 text-sm">{nivel.codigo}</p>
                                <p className={`text-xs mt-0.5 ${c.text} opacity-80`}>{nivel.nombre}</p>
                            </div>
                            {idx < niveles.length - 1 && (
                                <span className="text-gray-400 text-base select-none">➔</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
// REQ 2 — Hook de automatización por primer dígito
// Analiza el CUENTA_ID, detecta el primer dígito y aplica la regla
// correspondiente de AUTOMATIZACION_DIGITO al formulario.
// Devuelve la regla activa (o null) para que el formulario sepa
// qué campos bloquear y qué opciones mostrar.
// ══════════════════════════════════════════════════════════════════════
// REEMPLAZA TU FUNCIÓN useAutomatizacionDigito ACTUAL POR ESTA:
function useAutomatizacionDigito(cuentaId, setForm) {
    const primerDigitoRef = useRef('');
    const idSeguro = String(cuentaId || ''); 

    const aplicar = useCallback((id) => {
        const soloNumeros = String(id || '').replace(/[^0-9]/g, '');
        const digito      = soloNumeros.charAt(0) || '';

        if (digito === primerDigitoRef.current) return;
        primerDigitoRef.current = digito;

        const regla = AUTOMATIZACION_DIGITO[digito] || null;
        if (!regla) {
            setForm((f) => {
                if (!f.RUBRO && !f.TIPO_SALDO && !f.CLASIFICACION_HOJA && !f.SUB_RUBRO) return f;
                return { ...f, RUBRO: '', TIPO_SALDO: '', CLASIFICACION_HOJA: '', SUB_RUBRO: '' };
            });
            return;
        }
        
        setForm((f) => {
            // Validar si los valores ya son iguales para no provocar re-renders infinitos
            if (f.RUBRO === regla.RUBRO && f.TIPO_SALDO === regla.TIPO_SALDO && 
                f.CLASIFICACION_HOJA === regla.CLASIFICACION_HOJA && f.SUB_RUBRO === regla.SUB_RUBRO) {
                return f;
            }
            return {
                ...f,
                RUBRO:              regla.RUBRO,
                TIPO_SALDO:         regla.TIPO_SALDO,
                CLASIFICACION_HOJA: regla.CLASIFICACION_HOJA,
                SUB_RUBRO:          regla.SUB_RUBRO,
            };
        });
    }, [setForm]);

    const digitoActual = idSeguro.replace(/[^0-9]/g, '').charAt(0) || '';
    return { aplicar, reglaActiva: AUTOMATIZACION_DIGITO[digitoActual] || null };
}


// ══════════════════════════════════════════════════════════════════════
// Formulario de cuenta con automatización por dígito
// ══════════════════════════════════════════════════════════════════════
function FormularioCuenta({
    form, setForm,
    modoEdicion       = false,
    erroresBackend,
    onLimpiarErrores,
    alertasExternas   = {},      // alertas de duplicados que vienen de onBlur async
    onBlurID,                    // handler async duplicado ID
    onBlurNombre,                // handler async duplicado Nombre
}) {

    const [alertasCampos, setAlertasCampos] = useState(ALERTAS_VACIAS);
    const { aplicar, reglaActiva } = useAutomatizacionDigito(form.CUENTA_ID, setForm);

    // COMBINACIÓN INTELIGENTE: Si hay un error local de formato en el input, 
    // lo priorizamos de inmediato para pintar en rojo y mostrar el mensaje en pantalla.
    const alertas = {
        CUENTA_ID: alertasCampos.CUENTA_ID || alertasExternas.CUENTA_ID || '',
        NOMBRE: alertasCampos.NOMBRE || alertasExternas.NOMBRE || '',
        NUM_REFERENCIA: alertasCampos.NUM_REFERENCIA || '', 
    };

    // INYECTA ESTO DEBAJO DE LA CONSTANTE "const alertas = { ... };":
    const idLimpioParaBanco = String(form.CUENTA_ID || '').replace(/[- ]/g, '');
    const esCuentaBancaria = 
        (form.CUENTA_ID.startsWith('1-10') && idLimpioParaBanco.length === 5) || 
        (form.CUENTA_ID.startsWith('110') && idLimpioParaBanco.length === 5);


    // ══════════════════════════════════════════════════════════════════════
    // EFECTOS DE DUPLICADOS CORREGIDOS CON LIMPIEZA INMEDIATA DE ESTADOS
    // ══════════════════════════════════════════════════════════════════════
    useEffect(() => {
        const idLimpio = form.CUENTA_ID.trim();

        // Si el ID está vacío o tiene errores obvios de formato local,
        // no consultamos a Oracle y forzamos a limpiar cualquier alerta asíncrona vieja.
        if (idLimpio === '' || idLimpio.startsWith('-') || idLimpio.includes('--') || idLimpio.endsWith('-') || /^-+$/.test(idLimpio) || idLimpio.replace(/-/g, '').length > 5) {
            return;
        }

        const delayID = setTimeout(() => {
            if (onBlurID) onBlurID(form.CUENTA_ID);
        }, 150); // Consulta veloz a la base de datos de Oracle

        return () => clearTimeout(delayID);
    }, [form.CUENTA_ID, onBlurID, alertasCampos.CUENTA_ID]);

    useEffect(() => {
        const nombreLimpio = form.NOMBRE.trim();

        // Si el nombre es muy corto o tiene problemas de espacios iniciales/múltiples,
        // cancelamos la petición asíncrona para que no choque con las alertas en pantalla.
        if (nombreLimpio.length < 3 || form.NOMBRE.startsWith(' ') || form.NOMBRE.includes('  ')) {
            return;
        }

        const delayNombre = setTimeout(() => {
            if (onBlurNombre) onBlurNombre(nombreLimpio);
        }, 150); // Consulta veloz independiente para el campo Nombre

        return () => clearTimeout(delayNombre);
    }, [form.NOMBRE, onBlurNombre, alertasCampos.NOMBRE]);




    // REEMPLAZA TODA TU FUNCIÓN handleChange POR ESTA:
// ══════════════════════════════════════════════════════════════════════
// NUEVO HANDLECHANGE CON ALERTAS INSTANTÁNEAS EN EL CAMPO AL TECLEAR
// ══════════════════════════════════════════════════════════════════════
    const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'CUENTA_ID') {
        // 1. Bloqueo físico inmediato para caracteres totalmente prohibidos (letras o símbolos raros)
        if (value !== '' && !/^[0-9-]*$/.test(value)) {
            setAlertasCampos((p) => ({ 
                ...p, 
                CUENTA_ID: '❌ Símbolo o letra inválida. Solo se permiten números y guiones.' 
            }));
            return; 
        }

        // 2. BLOQUEO FÍSICO: No permitir que inicie con guión bajo ninguna circunstancia
        if (value.startsWith('-')) {
            setAlertasCampos((p) => ({ 
                ...p, 
                CUENTA_ID: '❌ El ID debe iniciar con un número, no con un guión.' 
            }));
            return; 
        }

        // 3. BLOQUEO FÍSICO: Si ya hay un guión al final, impedir que el usuario pulse otro guión seguido
        if (value.includes('--')) {
            setAlertasCampos((p) => ({ 
                ...p, 
                CUENTA_ID: '❌ Formato inválido. No puede colocar guiones seguidos.' 
            }));
            return; 
        }

        // 4. BLOQUEO FÍSICO: Límite estricto de números totales (Máximo formato X-XX-XX = 5 dígitos, 7 caracteres en total)
        if (value.replace(/-/g, '').length > 5) {
            setAlertasCampos((p) => ({ 
                ...p, 
                CUENTA_ID: '❌ El ID excede el límite contable permitido (máximo 5 dígitos o 7 caracteres, ej: 11005 o 1-10-05).' 
            }));
            return; 
        }

        // Advertencia preventiva normal si el usuario va escribiendo bien y pone un guión intermedio válido
        const msgErrorId = value.endsWith('-')
            ? '⚠️ Continúa ingresando el siguiente segmento numérico (ej: 1-10-...).'
            : '';

        setAlertasCampos((p) => ({ ...p, CUENTA_ID: msgErrorId }));
        setForm((f) => ({ ...f, [name]: value }));
        aplicar(value);

    } else if (name === 'NOMBRE') {
        // 1. Bloqueo físico inmediato para símbolos o números en el nombre
        if (value !== '' && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/.test(value)) {
            setAlertasCampos((p) => ({ 
                ...p, 
                NOMBRE: '❌ Símbolo o número inválido. Solo se permiten letras y espacios.' 
            }));
            return; 
        }

        // 2. BLOQUEO FÍSICO: No permitir que comience con un espacio en blanco
        if (value.startsWith(' ')) {
            setAlertasCampos((p) => ({ 
                ...p, 
                NOMBRE: '❌ El nombre de la cuenta no puede iniciar con un espacio.' 
            }));
            return; 
        }

        // 3. BLOQUEO FÍSICO: Si el usuario presiona la barra espaciadora dos veces seguidas, se congela el teclado
        if (value.includes('  ')) {
            setAlertasCampos((p) => ({ 
                ...p, 
                NOMBRE: '❌ Formato inválido. No se permiten espacios múltiples consecutivos.' 
            }));
            return; 
        }

        // Alerta sobre la marcha de longitud mínima (no bloquea la escritura para que pueda llegar a las 3 letras)
        const trimmed = value.trimEnd();
        const msgErrorNombre = trimmed.length > 0 && trimmed.length < 3
            ? '❌ El nombre es demasiado corto. Debe tener al menos 3 caracteres.'
            : '';

        setAlertasCampos((p) => ({ ...p, NOMBRE: msgErrorNombre }));
        setForm((f) => ({ ...f, [name]: value }));

    } else if (name === 'NUM_REFERENCIA') {
        // 1. BLOQUEO FÍSICO: Evitar letras o símbolos raros (Solo permite números y guiones)
        if (value !== '' && !/^[0-9-]*$/.test(value)) {
            setAlertasCampos((p) => ({ 
                ...p, 
                NUM_REFERENCIA: '❌ Carácter inválido. Solo se permiten números y guiones.' 
            }));
            return; 
        }

        // 2. BLOQUEO FÍSICO: No permitir que el número de cuenta inicie con un guión
        if (value.startsWith('-')) {
            setAlertasCampos((p) => ({ 
                ...p, 
                NUM_REFERENCIA: '❌ El número de cuenta debe iniciar con un dígito numérico.' 
            }));
            return;
        }

        // 3. BLOQUEO FÍSICO: Impedir guiones consecutivos (ej: 455--01)
        if (value.includes('--')) {
            setAlertasCampos((p) => ({ 
                ...p, 
                NUM_REFERENCIA: '❌ Formato inválido. No se permiten guiones consecutivos.' 
            }));
            return;
        }

        let msgErrorBanco = '';

        // 4. BLOQUEO FÍSICO: Control de guiones puros vacíos (ej: ------ )
        if (value.trim() !== '' && /^-+$/.test(value)) {
            msgErrorBanco = '❌ Formato inválido. No puede ingresar una cadena de puros guiones.';
        }
        // 5. BLOQUEO FÍSICO: Límite estricto de longitud (Máximo 15 caracteres totales incluyendo guiones)
        else if (value.length > 15) {
            msgErrorBanco = '❌ Longitud excedida. El número de cuenta no puede superar los 15 caracteres.';
            setAlertasCampos((p) => ({ ...p, NUM_REFERENCIA: msgErrorBanco }));
            return; 
        }
        // 6. Validación de longitud mínima contable para una cuenta real (Mínimo 8 caracteres)
        else if (value.trim().length > 0 && value.replace(/-/g, '').length < 8) {
            msgErrorBanco = '❌ El número de cuenta es demasiado corto para un registro bancario real.';
        }

        setAlertasCampos((p) => ({ ...p, NUM_REFERENCIA: msgErrorBanco }));
        setForm((f) => ({ ...f, [name]: value }));

    } else {
        setForm((f) => ({ ...f, [name]: value }));
    }

    if (onLimpiarErrores) onLimpiarErrores();
};

    // ── AGREGA ESTA FUNCIÓN JUSTO ARRIBA DE TU BLOQUE "return (" EN FORMULARIOCUENTA: ──
    const handleBlur = (e) => {
        const { name, value } = e.target;
        // Si el usuario abandona un campo obligatorio dejándolo vacío, le pinta la advertencia
        if (value.trim() === '') {
            setAlertasCampos((p) => ({ ...p, [name]: '⚠️ Este campo es obligatorio.' }));
        }
    };

    // ── Determina qué campos están bloqueados ─────────────────────────
    // En modo creación: bloqueados por automatización del dígito.
    // En modo edición: el RUBRO se puede cambiar libremente (rescate).
    const camposLibres = !modoEdicion && reglaActiva ? reglaActiva.CAMPOS_LIBRES : ['RUBRO', 'SUB_RUBRO', 'CLASIFICACION_HOJA'];
    const todosBloqueados = !modoEdicion && reglaActiva && reglaActiva.CAMPOS_LIBRES.length === 0;
    const tieneDigito  = !modoEdicion && !!reglaActiva;

    // Opciones dinámicas de SUB_RUBRO y CLASIFICACION_HOJA
    const opcionesSub   = tieneDigito && reglaActiva.OPCIONES_SUB.length > 0
        ? reglaActiva.OPCIONES_SUB
        : (MATRIZ[form.RUBRO]?.SUB_RUBROS || []);

    const opcionesClase = tieneDigito && reglaActiva.OPCIONES_CLASE.length > 0
        ? reglaActiva.OPCIONES_CLASE
        : (MATRIZ[form.RUBRO]?.CLASIFICACIONES_HOJA || []);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PanelErrores errores={erroresBackend} onCerrar={onLimpiarErrores} />

            {(form.RUBRO === 'PASIVO' || ['2','3'].includes(String(form.CUENTA_ID ?? '').replace(/[^0-9]/g, '').charAt(0))) && (
                 <NotaPatrimonio />
            )}

            {/* ── ID de Cuenta (solo creación) ── */}
{!modoEdicion && (
    <div>
        <Label required>ID de Cuenta</Label>
        <input
            name="CUENTA_ID"
            value={form.CUENTA_ID}
            onChange={handleChange}
            onBlur={handleBlur}
            // Usa directamente la alerta unificada (local o asíncrona) para pintar en rojo al instante
            className={alertas.CUENTA_ID ? inputError : inputNormal}
            placeholder="Ej. 1-10-01 o 11010"
        />
        {/* Muestra la alerta inmediata de formato, guiones, longitud o el duplicado asíncrono de Oracle */}
        <FieldAlerta mensaje={alertas.CUENTA_ID} />
        
        {/* REQ 5 — Preview desglose mientras escribe (Solo si el ID va limpio y correcto) */}
        {form.CUENTA_ID && !alertas.CUENTA_ID && (
            <DesgloseHorizontal
                cuentaId={form.CUENTA_ID.replace(/[- ]/g, '')}
                nombre={form.NOMBRE}
            />
        )}
    </div>
)}


            {/* ── Nombre ── */}
<div>
    <Label required>Nombre de la Cuenta</Label>
    <input
        name="NOMBRE"
        value={form.NOMBRE}
        onChange={handleChange}
        onBlur={handleBlur}
        // Usa la alerta unificada para pintar en rojo de inmediato si encuentra un duplicado o espacios extras
        className={alertas.NOMBRE ? inputError : inputNormal}
        placeholder="Ej. Caja General"
    />
    {/* Muestra la alerta inmediata de espacios múltiples, longitud mínima o nombre duplicado */}
    <FieldAlerta mensaje={alertas.NOMBRE} />
</div>


            {/* ── RUBRO ── */}
            {modoEdicion ? (
                <SelectField
                    label="Rubro"
                    name="RUBRO"
                    value={form.RUBRO}
                    onChange={handleChange}
                    opciones={RUBROS}
                    required
                />
            ) : (
                <ReadOnlyField
                    label="Rubro"
                    value={form.RUBRO}
                    hint={tieneDigito ? 'Asignado automáticamente por el ID.' : 'Ingresa el ID para autoasignar.'}
                />
            )}

            {/* ── TIPO_SALDO — siempre readOnly ── */}
            <ReadOnlyField
                label="Tipo de Saldo"
                value={form.TIPO_SALDO}
                hint={tieneDigito ? 'Calculado automáticamente.' : undefined}
            />

            {/* ── CLASIFICACION_HOJA ── */}
            {!modoEdicion && tieneDigito && camposLibres.includes('CLASIFICACION_HOJA') ? (
                <SelectField
                    label="Clasificación Hoja"
                    name="CLASIFICACION_HOJA"
                    value={form.CLASIFICACION_HOJA}
                    onChange={handleChange}
                    opciones={opcionesClase}
                    required
                />
            ) : modoEdicion && MATRIZ[form.RUBRO]?.CLASIFICACION_LIBRE ? (
                <SelectField
                    label="Clasificación Hoja"
                    name="CLASIFICACION_HOJA"
                    value={form.CLASIFICACION_HOJA}
                    onChange={handleChange}
                    opciones={MATRIZ[form.RUBRO]?.CLASIFICACIONES_HOJA || []}
                    required
                />
            ) : (
                <ReadOnlyField
                    label="Clasificación Hoja"
                    value={form.CLASIFICACION_HOJA}
                    hint={tieneDigito || modoEdicion ? 'Fija para este tipo de cuenta.' : undefined}
                />
            )}

            {/* ── SUB_RUBRO ── */}
            {(!modoEdicion && tieneDigito && camposLibres.includes('SUB_RUBRO')) || modoEdicion ? (
                <SelectField
                    label="Sub Rubro"
                    name="SUB_RUBRO"
                    value={form.SUB_RUBRO}
                    onChange={handleChange}
                    opciones={modoEdicion ? (MATRIZ[form.RUBRO]?.SUB_RUBROS || []) : opcionesSub}
                    required
                    disabled={modoEdicion ? false : todosBloqueados}
                />
            ) : (
                <ReadOnlyField
                    label="Sub Rubro"
                    value={form.SUB_RUBRO}
                    hint={tieneDigito ? 'Asignado automáticamente.' : undefined}
                />
            )}

            {/* ── ESTADO — solo edición ── */}
            {modoEdicion && (
                <SelectField
                    label="Estado"
                    name="ESTADO"
                    value={form.ESTADO}
                    onChange={handleChange}
                    opciones={ESTADO_OPTS}
                />
            )}

            {/* BUSCA TU CONTENEDOR ANIMADO DE BANCOS EN EL JSX Y REEMPLÁZALO CON ESTAS LÍNEAS DE ADVERTENCIA: */}
<div className={`col-span-full transition-all duration-500 ease-in-out overflow-hidden ${esCuentaBancaria ? 'max-h-36 opacity-100 mt-2' : 'max-h-0 opacity-0 pointer-events-none'}`}>
    <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 shadow-inner">
        <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
            Número de Cuenta / Referencia Bancaria <span className="text-red-500">*</span>
        </label>
        <div className="relative mt-1">
            <input 
                type="text" 
                name="NUM_REFERENCIA"
                value={form.NUM_REFERENCIA || ''}
                onChange={handleChange}
                // Si hay un error de formato, cambia automáticamente a la clase de borde rojo
                className={alertas.NUM_REFERENCIA ? inputError : inputNormal}
                placeholder="Ej. 455-021-01 ó 12-34567-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🏦</span>
        </div>
        
        {/* Renderiza el mensaje de error en letras rojas si el usuario introduce un formato inválido */}
        <FieldAlerta mensaje={alertas.NUM_REFERENCIA} />
        
        {!alertas.NUM_REFERENCIA && (
            <p className="text-[10px] text-blue-600 mt-1 font-medium">
                💡 Campo requerido: Ingrese un formato bancario válido (ej. 455-021-01). Máximo 15 caracteres.
            </p>
        )}
    </div>
</div>


            {/* REQ 5 — Preview desglose mientras escribe */}
            {form.CUENTA_ID && !alertas.CUENTA_ID && (
                <div className="col-span-full">
                    <DesgloseHorizontal
                        cuentaId={form.CUENTA_ID.replace(/[- ]/g, '')}
                        nombre={form.NOMBRE}
                    />
                </div>
            )}

        </div> // Este es el div de cierre de la cuadrícula (grid)
    );
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
function CatalogoCuentas() {
    const navigate    = useNavigate();
    const { usuario } = useAuth();

    const [cuentas,        setCuentas]        = useState([]);
    const [mensaje,        setMensaje]        = useState({ texto: '', tipo: '' });
    const [form,           setForm]           = useState(FORM_VACIO);
    const [formEditar,     setFormEditar]     = useState(FORM_VACIO);
    const [modalVisible,   setModalVisible]   = useState(false);
    const [modalEliminar,  setModalEliminar]  = useState({ visible: false, id: null });
    const [erroresCrear,   setErroresCrear]   = useState([]);
    const [erroresEditar,  setErroresEditar]  = useState([]);
    const [filtroActivo,   setFiltroActivo]   = useState('');
    const [cuentaDesglose, setCuentaDesglose] = useState(null);
    const [bancoExpandido, setBancoExpandido] = useState(null);

    // REQ 4 — estado del buscador por texto
    const [busqueda,       setBusqueda]       = useState('');
    const busquedaTimeout  = useRef(null);

    // REQ 3 — alertas de duplicados async (formulario de creación)
    const [alertasAsync, setAlertasAsync] = useState({ CUENTA_ID: '', NOMBRE: '' });

    // REQ 3 — alertas de duplicados async (formulario de edición)
    const [alertasAsyncEditar, setAlertasAsyncEditar] = useState({ NOMBRE: '' });

    // ── Carga de cuentas ─────────────────────────────────────────────
    const cargarCuentas = useCallback(async (prefijo = '', search = '') => {
        try {
            const res = await cuentasService.getAll(prefijo, search);
            setCuentas(res.data);
        } catch {
            mostrarMensaje('Error al cargar cuentas', 'error');
        }
    }, []);

    // Recarga cuando cambia filtro o búsqueda
    useEffect(() => {
        cargarCuentas(filtroActivo, busqueda);
    }, [filtroActivo, busqueda, cargarCuentas]);

    // ── Helper mensajes ───────────────────────────────────────────────
    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    // ══════════════════════════════════════════════════════════════════
    // REQ 4 — Buscador con debounce (300 ms)
    // ══════════════════════════════════════════════════════════════════
    const handleBusqueda = (e) => {
        const valor = e.target.value;
        setBusqueda(valor);
        // debounce para no disparar una petición por cada tecla
        clearTimeout(busquedaTimeout.current);
        busquedaTimeout.current = setTimeout(() => {
            cargarCuentas(filtroActivo, valor);
        }, 300);
    };

    // ══════════════════════════════════════════════════════════════════
    // REQ 3 — onBlur async: verifica duplicado de ID
    // ══════════════════════════════════════════════════════════════════
    // Agrega este ref junto a los otros refs al inicio del componente
    // BUSCA ESTAS FUNCIONES EN CatalogoCuentas Y REEMPLÁZALAS COMPLETA:

    const debounceIdRef     = useRef(null);
    const debounceNombreRef = useRef(null);

    const verificarDuplicadoID = useCallback((valor) => {
        // Si viene vacío o inválido de entrada, limpia de inmediato sin ir a la BD
        if (!valor || valor.startsWith('-') || valor.includes('--')) {
            setAlertasAsync((p) => ({ ...p, CUENTA_ID: '' }));
        return;
    }
    
    clearTimeout(debounceIdRef.current);
        debounceIdRef.current = setTimeout(async () => {
            try {
                const idLimpio = String(valor).replace(/[- ]/g, '');
                const res = await cuentasService.checkDuplicado({ id: idLimpio });
                setAlertasAsync((p) => ({
                    ...p, CUENTA_ID: res.data.existe ? `❌ El ID [${valor}] ya existe en el sistema.` : '',
                }));
            } catch {
                setAlertasAsync((p) => ({ ...p, CUENTA_ID: '' }));
            }
        }, 150); // Bajamos a 150ms para que sea en tiempo real al digitar
    }, []);

    const verificarDuplicadoNombre = useCallback((valor) => {
        if (!valor || valor.startsWith(' ') || valor.includes('  ') || valor.trim().length < 3) {
            setAlertasAsync((p) => ({ ...p, NOMBRE: '' }));
        return;
    }

    clearTimeout(debounceNombreRef.current);
        debounceNombreRef.current = setTimeout(async () => {
            try {
                const res = await cuentasService.checkDuplicado({ nombre: valor.trim() });
                setAlertasAsync((p) => ({
                    ...p, NOMBRE: res.data.existe ? '❌ Ya existe una cuenta registrada con este nombre.' : '',
                }));
            } catch {
                setAlertasAsync((p) => ({ ...p, NOMBRE: '' }));
            }
        }, 150); // Respuesta ultra veloz al escribir de forma independiente
    }, []);

// REQ 3 — onBlur async: verifica duplicado de Nombre (edición, excluye ID propio)
    const verificarDuplicadoNombreEditar = useCallback(async (valor) => {
    // Blindaje anti-pantallazo blanco: validar que exista un ID válido antes de evaluar strings
    const idSeguro = formEditar && formEditar.CUENTA_ID ? String(formEditar.CUENTA_ID) : '';
        if (!idSeguro || !valor || valor.trim().length < 3) {
            setAlertasAsyncEditar((p) => ({ ...p, NOMBRE: '' }));
        return;
    }

    try {
        const res = await cuentasService.checkDuplicado({
            nombre:    valor.trim(),
            excludeId: idSeguro.replace(/[- ]/g, ''),
        });
        setAlertasAsyncEditar((p) => ({
            ...p, NOMBRE: res.data.existe ? '❌ Este nombre ya está ocupado por otra cuenta.' : ''
        }));
    } catch {
        setAlertasAsyncEditar((p) => ({ ...p, NOMBRE: '' }));
    }
    }, [formEditar]);


    // ══════════════════════════════════════════════════════════════════
    // REQ 6 — Estado consolidado del botón "Crear Cuenta"
    // ══════════════════════════════════════════════════════════════════
    const motivoID        = motivoIDInvalido(form.CUENTA_ID);
    const nombreCorto     = form.NOMBRE.trim().length > 0 && form.NOMBRE.trim().length < 3;
    
    // DETECTOR DE BANCOS EN EL PADRE: Evalúa la longitud limpia (5 dígitos)
    const idLimpioPadre   = String(form.CUENTA_ID || '').replace(/[- ]/g, '');
    const esBancoPadre    = 
        (form.CUENTA_ID.startsWith('1-10') && idLimpioPadre.length === 5) || 
        (form.CUENTA_ID.startsWith('110') && idLimpioPadre.length === 5);

    // Si es cuenta de banco, obliga a que NUM_REFERENCIA tenga texto escrito
    const referenciaVacia = esBancoPadre && !String(form.NUM_REFERENCIA || '').trim();

    const camposFaltantes = !form.RUBRO || !form.NOMBRE.trim() || !form.SUB_RUBRO || !form.CLASIFICACION_HOJA || referenciaVacia;
    const hayDuplicado    = !!alertasAsync.CUENTA_ID || !!alertasAsync.NOMBRE;

    const botonDeshabilitado = !!motivoID || nombreCorto || camposFaltantes || hayDuplicado || !!alertasAsync.NUM_REFERENCIA;


    // Texto explicativo dinámico del bloqueo (Grita el error específico primero)
    const motivosBloqueo = [];
    if (motivoID) {
        motivosBloqueo.push(motivoID);
    } else if (alertasAsync.CUENTA_ID) {
        motivosBloqueo.push('El ID ingresado ya existe en el sistema.');
    } else if (alertasAsync.NOMBRE) {
        motivosBloqueo.push('El nombre ingresado ya existe en el sistema.');
    } else if (referenciaVacia) {
        motivosBloqueo.push('El número de cuenta bancaria/referencia es obligatorio.');
    } else if (nombreCorto) {
        motivosBloqueo.push('El nombre debe tener al menos 3 caracteres.');
    } else if (camposFaltantes) {
        motivosBloqueo.push('Completa todos los campos obligatorios.');
    }

    const textoBloqueo = motivosBloqueo.length > 0
        ? `Botón bloqueado: ${motivosBloqueo[0]}`
        : '';


    // ── Crear ─────────────────────────────────────────────────────────
    const handleCrear = async () => {
        setErroresCrear([]);
        try {
            await cuentasService.create(form, usuario.USER_ID);
            mostrarMensaje('Cuenta creada correctamente', 'exito');
            setForm(FORM_VACIO);
            setAlertasAsync({ CUENTA_ID: '', NOMBRE: '' });
            cargarCuentas(filtroActivo, busqueda);
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
    const handleAbrirModal = (cuenta) => {
    setErroresEditar([]);
    setAlertasAsyncEditar({ NOMBRE: '' });
    
    // Forzamos que el ID sea string y aseguramos strings vacíos si el campo viene null
    setFormEditar({
        CUENTA_ID: cuenta.CUENTA_ID ? String(cuenta.CUENTA_ID) : '',
        NOMBRE: cuenta.NOMBRE || '',
        RUBRO: cuenta.RUBRO || '',
        TIPO_SALDO: cuenta.TIPO_SALDO || '',
        CLASIFICACION_HOJA: cuenta.CLASIFICACION_HOJA || '',
        SUB_RUBRO: cuenta.SUB_RUBRO || '',
        ESTADO: cuenta.ESTADO || 'ACTIVO',
    });
    
    setModalVisible(true);
};


    // ── Actualizar ────────────────────────────────────────────────────
    const handleActualizar = async () => {
        setErroresEditar([]);
        try {
            await cuentasService.update(formEditar.CUENTA_ID, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Cuenta actualizada correctamente', 'exito');
            cargarCuentas(filtroActivo, busqueda);
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
            if (cuentaDesglose?.CUENTA_ID === modalEliminar.id) setCuentaDesglose(null);
            mostrarMensaje('Cuenta eliminada correctamente', 'exito');
            cargarCuentas(filtroActivo, busqueda);
        } catch (err) {
            mostrarMensaje(err.response?.data?.message || 'Error al eliminar cuenta', 'error');
        }
    };

    // ── Badge helpers ─────────────────────────────────────────────────
    const badgeEstado = (estado) =>
        estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

    const esCoherente = (c) => {
        const regla = MATRIZ[c.RUBRO];
        if (!regla) return false;
        const tipoOk  = c.TIPO_SALDO === regla.TIPO_SALDO;
        const claseOk = regla.CLASIFICACIONES_HOJA
            ? regla.CLASIFICACIONES_HOJA.includes(c.CLASIFICACION_HOJA)
            : c.CLASIFICACION_HOJA === regla.CLASIFICACION_HOJA;
        const subOk   = regla.SUB_RUBROS.includes(c.SUB_RUBRO);
        return tipoOk && claseOk && subOk;
    };

    // ── Estado del botón de edición ───────────────────────────────────
    const botonEditarDeshabilitado =
        !formEditar.RUBRO || !formEditar.NOMBRE.trim() ||
        !formEditar.SUB_RUBRO || !formEditar.CLASIFICACION_HOJA ||
        !!alertasAsyncEditar.NOMBRE;

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
                        alertasExternas={alertasAsync}
                        onBlurID={verificarDuplicadoID}
                        onBlurNombre={verificarDuplicadoNombre}
                    />
                    <div className="mt-5">
                        {/* REQ 6 — Botón con bloqueo unificado */}
                        <button
                            onClick={handleCrear}
                            disabled={botonDeshabilitado}
                            className="bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                        >
                            + Crear Cuenta
                        </button>
                                                {/* ── NOTIFICACIÓN DINÁMICA DE AYUDA AL USUARIO (PREMIUM) ── */}
                        {botonDeshabilitado && textoBloqueo && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 max-w-xl mt-3 animate-fadeIn">
                                <span className="text-amber-500 text-sm mt-0.5 shrink-0">🔒</span>
                                <div>
                                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Botón bloqueado</p>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                        {textoBloqueo.toLowerCase().includes('bloqueado') ? textoBloqueo : `Botón bloqueado: ${textoBloqueo.replace('⚠️', '').trim()}`}
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    REQ 3 + REQ 4 — Filtros por categoría + Buscador
                ══════════════════════════════════════════════════════ */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 space-y-4">

                    {/* Filtros por categoría transformado en Desplegable */}
                    <div className="w-full max-w-xs">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Filtrar por categoría o tipo
                        </p>
                        <select
                            value={filtroActivo}
                            onChange={(e) => {
                                setFiltroActivo(e.target.value);
                                setBusqueda('');           // limpia búsqueda al cambiar categoría
                                setCuentaDesglose(null);
                            }}
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent shadow-sm transition-all cursor-pointer"
                        >
                            {CATEGORIAS_FILTRO.map((cat) => (
                                <option 
                                    key={cat.prefijo} 
                                    value={cat.prefijo}
                                    className="py-1 text-gray-800"
                                >
                                    {cat.prefijo && cat.prefijo !== 'BANCOS' ? `${cat.prefijo} — ` : ''}{cat.label}
                                </option>
                            ))}
                        </select>
                    </div>


                    {/* REQ 4 — Buscador general por texto */}
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={handleBusqueda}
                            placeholder="Buscar por código o nombre..."
                            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-colors"
                        />
                        {busqueda && (
                            <button
                                onClick={() => { setBusqueda(''); cargarCuentas(filtroActivo, ''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                            >
                                ✕
                            </button>
                        )}
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

                    {/* REQ 5 — Panel de desglose de la cuenta seleccionada */}
                    {cuentaDesglose && (
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Desglose: {cuentaDesglose.NOMBRE}
                                </p>
                                <button
                                    onClick={() => setCuentaDesglose(null)}
                                    className="text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕ Cerrar
                                </button>
                            </div>
                            <DesgloseHorizontal
                                cuentaId={cuentaDesglose.CUENTA_ID}
                                nombre={cuentaDesglose.NOMBRE}
                            />
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1E3A5F] text-white">
                                    {['ID', 'Nombre', 'Tipo Saldo', 'Clasificación', 'Rubro', 'Sub Rubro', 'Estado', ''].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                     
                                    // 1. Filtramos las cuentas antes del render
                                    const cuentasFiltradas = cuentas.filter(cuenta => {
                                        if (filtroActivo === 'BANCOS') {
                                            const idLimpio = String(cuenta.CUENTA_ID || '').replace(/[- ]/g, '');
                                            return (
                                                (String(cuenta.CUENTA_ID || '').startsWith('1-10') && idLimpio.length === 5) || 
                                                (String(cuenta.CUENTA_ID || '').startsWith('110') && idLimpio.length === 5)
                                            );
                                        }
                                        return true;
                                    });

                                    // 2. Si no hay registros con el filtro activo, tiramos el tr de aviso
                                    if (cuentasFiltradas.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={8} className="text-center py-10 text-gray-400">
                                                    {busqueda ? `Sin resultados para "${busqueda}".` : 'No hay cuentas registradas.'}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // 3. El mapeo real se hace sobre la lista filtrada
                                    return cuentasFiltradas.map((cuenta, i) => {


                                    const corrupto    = !esCoherente(cuenta);
                                    const seleccionada = cuentaDesglose?.CUENTA_ID === cuenta.CUENTA_ID;
                                    
                                    // ── DETECTOR DE BANCOS AUTOMÁTICO EN TU TABLA ──
                                    const idLimpioTabla = String(cuenta.CUENTA_ID || '').replace(/[- ]/g, '');
                                    const esCuentaBanco = 
                                        (String(cuenta.CUENTA_ID || '').startsWith('1-10') && idLimpioTabla.length === 5) || 
                                        (String(cuenta.CUENTA_ID || '').startsWith('110') && idLimpioTabla.length === 5);

                                    // Verifica si tiene guardado un número de referencia física en Oracle
                                    const tieneReferencia = cuenta.NUM_REFERENCIA !== null && cuenta.NUM_REFERENCIA !== undefined && String(cuenta.NUM_REFERENCIA).trim() !== '';
                                    
                                    // Se muestra la flecha si es cuenta de banco y tiene datos que mostrar
                                    const mostrarAcordeonBanco = esCuentaBanco && tieneReferencia;
                                    const estaBancoAbierto     = bancoExpandido === cuenta.CUENTA_ID;

                                    return (
                                        <>
                                            {/* ── FILA PRINCIPAL DE LA CUENTA ── */}
                                            <tr
                                                key={cuenta.CUENTA_ID}
                                                className={`
                                                    transition-colors
                                                    ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                                    ${corrupto     ? 'border-l-4 border-amber-400' : ''}
                                                    ${seleccionada ? 'ring-2 ring-inset ring-[#1E3A5F]/30' : ''}
                                                    ${estaBancoAbierto ? 'bg-blue-50/30' : ''}
                                                `}
                                            >
                                                <td className="px-4 py-3 font-mono text-gray-600">
                                                    <div className="flex items-center gap-1.5">
                                                        {/* Flecha interactiva: Solo aparece en cuentas de banco */}
                                                        {mostrarAcordeonBanco && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setBancoExpandido(estaBancoAbierto ? null : cuenta.CUENTA_ID)}
                                                                className={`p-0.5 rounded hover:bg-gray-200 text-[#1E3A5F] font-bold text-[10px] transition-transform duration-200 ${
                                                                    estaBancoAbierto ? 'rotate-90' : ''
                                                                }`}
                                                                title="Ver cuenta bancaria"
                                                            >
                                                                ▶
                                                            </button>
                                                        )}
                                                        {cuenta.CUENTA_ID}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    <div className="flex items-center gap-2">
                                                        <span>{cuenta.NOMBRE}</span>
                                                        {esCuentaBanco && (
                                                            <span className="bg-blue-100 text-[#1E3A5F] text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                                                                Banco
                                                            </span>
                                                        )}
                                                        {corrupto && (
                                                            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                                                                ⚠ Inconsistente
                                                            </span>
                                                        )}
                                                    </div>
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
                                                <td className="px-4 py-3 text-center whitespace-nowrap space-x-1">
                                                    <button
                                                        onClick={() => setCuentaDesglose(seleccionada ? null : cuenta)}
                                                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium transition-all"
                                                        title="Ver desglose del código"
                                                    >
                                                        {seleccionada ? '▲ Ocultar' : '🔍 Ver'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAbrirModal(cuenta)}
                                                        className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium transition-all"
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
                                            {/* ── SUB-FILA DE DETALLE (MUESTRA TU CAMPO NUM_REFERENCIA) ── */}
                                            {mostrarAcordeonBanco && estaBancoAbierto && (
                                                <tr className="bg-blue-50/20 border-l-4 border-[#1E3A5F] transition-all">
                                                    <td colSpan={8} className="px-8 py-2.5 bg-gradient-to-r from-blue-50/30 to-transparent">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">
                                                                Detalle Bancario de la Cuenta:
                                                            </span>
                                                            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1 shadow-sm">
                                                                <span className="text-xs text-gray-500 font-medium">No. Cuenta Física:</span>
                                                                <span className="font-mono text-xs font-bold text-gray-900 tracking-wider">
                                                                    {cuenta.NUM_REFERENCIA}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                       );
                                     })}
                                  )()}
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

                        {!esCoherente(formEditar) && (
                            <div className="mx-6 mt-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-xs text-amber-800">
                                <strong>🔧 Modo Rescate activo:</strong> Este registro tiene inconsistencias.
                                Selecciona el <strong>Rubro correcto</strong> para normalizar los campos.
                            </div>
                        )}

                        {/* REQ 5 — Desglose en el modal */}
                        <div className="px-6 pt-4">
                            <DesgloseHorizontal
                                cuentaId={formEditar.CUENTA_ID}
                                nombre={formEditar.NOMBRE}
                            />
                        </div>

                        <div className="p-6">
                            <FormularioCuenta
                                form={formEditar}
                                setForm={setFormEditar}
                                modoEdicion
                                erroresBackend={erroresEditar}
                                onLimpiarErrores={() => setErroresEditar([])}
                                alertasExternas={alertasAsyncEditar}
                                onBlurNombre={verificarDuplicadoNombreEditar}
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
                                disabled={botonEditarDeshabilitado}
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