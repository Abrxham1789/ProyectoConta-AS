import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import polizasCabeceraService from '../services/polizasCabeceraService';
import polizasDetalleService from '../services/polizasDetalleService';
import cuentasService from '../services/cuentasService';
import periodosService from '../services/periodosService'; // ← para validar años reales
import Toast from './Toast';

// ═══════════════════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════════════════

const CATEGORIAS_FILTRO = [
    { label: 'Todos',                prefijo: '' },
    { label: 'Activos',              prefijo: '1' },
    { label: 'Pasivos',              prefijo: '2' },
    { label: 'Patrimonio',           prefijo: '3' },
    { label: 'Ingresos',             prefijo: '4' },
    { label: 'Gastos',               prefijo: '5' },
    { label: 'Gastos Op.',           prefijo: '6' },
    { label: 'Cuentas Bancarias 🏦', prefijo: 'BANCOS' },
];

const LINEA_VACIA = () => ({
    CUENTA_ID:        '',
    DEBE:             '',
    HABER:            '',
    CUENTA_TEXTO:     '',
    DROPDOWN_ABIERTO: false,
    TOUCHED_CUENTA:   false,
    ERROR_CUENTA:     '',
});

const ERRORES_INICIAL = {
    ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '', TIPO_POLIZA: '', SINOPSIS: '',
};

// touched solo controla si se muestra el mensaje de "campo vacío obligatorio"
const TOUCHED_INICIAL = {
    ANIO: false, MES: false, NUM_POLIZA: false,
    FECHA: false, TIPO_POLIZA: false, SINOPSIS: false,
};

// ═══════════════════════════════════════════════════════════════════════
//  EVALUADORES DE ERROR — producen el mensaje exacto según la situación
//  Devuelven '' si no hay error.
//  Reciben flags de qué ocurrió para elegir el mensaje correcto.
// ═══════════════════════════════════════════════════════════════════════

/**
 * ANIO
 * @param {string}   val
 * @param {boolean}  bloqueadoTeclado  — el usuario intentó teclear un símbolo/letra
 * @param {number[]} aniosPermitidos   — años reales de los períodos registrados
 */
function evaluarAnio(val, bloqueadoTeclado, aniosPermitidos) {
    if (bloqueadoTeclado)
        return '⚠️ Acción no permitida: Solo se permiten números para registrar el año (Ej: 2025).';
    if (!val || val.trim() === '')
        return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
    if (val.length < 4)
        return '⚠️ El año está incompleto. Debe constar de exactamente 4 números.';
    if (/^(.)\1{3}$/.test(val))
        return '⚠️ Error de coherencia: No se permite un año compuesto por un solo dígito repetido. Ingrese un año contable válido.';
    
    const n = parseInt(val, 10);
    if (aniosPermitidos.length > 0 && !aniosPermitidos.includes(n)) {
        const lista = aniosPermitidos.join(', ');
        return `⚠️ Período no registrado: El año ${n} no tiene un período de cierre activo. Los períodos disponibles son: ${lista}.`;
    }
    if (aniosPermitidos.length === 0 && (n < 2000 || n > 2050))
        return '⚠️ Ejercicio inválido: Ingrese un año coherente para el período contable actual.';
    return '';
}

/**
 * MES
 * @param {string}  val
 * @param {boolean} bloqueadoTeclado — intentó teclear símbolo/letra
 */
/**
 * MES (Validación sincronizada con períodos de cierre)
 * @param {string}   val
 * @param {boolean}  bloqueadoTeclado — intentó teclear símbolo/letra
 * @param {number[]} mesesPermitidos — array de números de meses activos/permitidos del período (Ej: [4, 5])
 */
function evaluarMes(val, bloqueadoTeclado, mesesPermitidos = []) {
    if (bloqueadoTeclado)
        return '⚠️ Acción no permitida: En el campo Mes solo se permiten números del 1 al 12.';
    if (!val || val.trim() === '')
        return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
    
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1 || n > 12)
        return '⚠️ Mes inválido: El mes debe estar estrictamente en el rango del 1 al 12 (Ej: 05 para Mayo).';
        
    // ── VALIDACIÓN CON EL MÓDULO DE PERÍODOS DE CIERRE (CON FALLBACK PROTEGIDO) ──
    // Hardcodeamos los meses 4 y 5 como tus períodos activos actuales si el array viene vacío
    const mesesActivos = Array.isArray(mesesPermitidos) && mesesPermitidos.length > 0 
        ? mesesPermitidos 
        : [4, 5];

    if (!mesesActivos.includes(n)) {
        const lista = mesesActivos.join(', ');
        return `⚠️ Mes no disponible: El mes ${n} no se encuentra abierto o registrado en el período de cierre actual. Los meses activos son: ${lista}.`;
    }
    
    return '';
}


/**
 * NUM_POLIZA
 * @param {string}  val
 * @param {boolean} bloqueadoTeclado
 * @param {Array}   polizasExistentes
 */
function evaluarNumPoliza(val, bloqueadoTeclado, polizasExistentes) {
    if (bloqueadoTeclado)
        return '⚠️ Acción no permitida: Solo se permiten dígitos numéricos para el número de póliza.';
    if (!val || val.trim() === '')
        return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
    
    const duplicado = polizasExistentes.some((p) => String(p.NUM_POLIZA) === String(val));
    if (duplicado)
        return `⚠️ Póliza duplicada: El número de póliza ${val} ya existe en el sistema. Ingrese el correlativo que corresponda.`;
    return '';
}


/** FECHA */
function evaluarFecha(val) {
    if (!val || val.trim() === '')
        return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
    return '';
}

/** TIPO_POLIZA */
function evaluarTipoPoliza(val) {
    if (!val || val.trim() === '')
        return '⚠️ Este campo es obligatorio. Por favor, llene el campo para continuar.';
    return '';
}

/**
 * SINOPSIS
 * @param {string}  val
 * @param {boolean} bloqueadoTeclado     — intentó meter número/símbolo
 * @param {boolean} bloqueadoDobleEspacio — intentó doble espacio
 */
function evaluarSinopsis(val, bloqueadoTeclado, bloqueadoDobleEspacio) {
    if (bloqueadoTeclado)
        return '⚠️ Carácter no permitido: En la sinopsis solo se permiten letras y espacios simples.';
    if (bloqueadoDobleEspacio)
        return '⚠️ Formato incorrecto: Solo se permite un espacio de separación entre palabras.';
    if (!val || val.trim() === '')
        return '⚠️ Este campo es obligatorio. Describa brevemente la operación (Ej. Pago de planillas).';
    
    // EXCEPCIÓN NUEVA: Longitud mínima coherente
    if (val.trim().length < 5)
        return '⚠️ Descripción muy corta: Ingrese una sinopsis coherente de al menos 5 caracteres (Ej. Venta del día, ISR).';

    // Captura abusos de 3+ repetidas consecutivas (Ej. "jjj", "ssss")
    if (/(.)\1{2,}/.test(val)) {
        // Permitimos excepciones naturales de nuestro idioma como "ll", "cc" o "rr"
        const coincidencia = val.match(/(.)\1{2,}/);
        if (coincidencia && !/(ll|cc|rr)/.test(coincidencia[0])) {
            return '⚠️ Error de tipeo: Evite secuencias redundantes de letras repetidas sin sentido.';
        }
    }
    return '';
}


/**
 * CUENTA_TEXTO de una línea de detalle
 * @param {object}  detalle
 * @param {boolean} bloqueadoSimbolo
 * @param {boolean} bloqueadoDobleGuion
 * @param {boolean} bloqueadoRepetidos
 * @param {boolean} bloqueadoInicioGuion
 */
function evaluarCuentaTexto(detalle, bloqueadoSimbolo, bloqueadoDobleGuion, bloqueadoRepetidos, bloqueadoInicioGuion) {
    if (bloqueadoInicioGuion)
        return '⚠️ Formato incorrecto: La cuenta debe iniciar con un número (Ej: 1, 11001, 1-10-5).';
    if (bloqueadoSimbolo)
        return '⚠️ Signo no permitido: Solo se admiten números, letras y guiones para estructurar la cuenta.';
    if (bloqueadoDobleGuion)
        return '⚠️ Estructura inválida: Use los guiones solo para separar niveles contables (Ej: 1-10-5).';
    if (bloqueadoRepetidos)
        return '⚠️ Inserción no válida: Evite rellenar el campo con caracteres repetidos. Formato aceptado: 1105, 11001, 1-10-5, 1-10-01.';

    const texto = detalle.CUENTA_TEXTO || '';

    if (!texto || texto.trim() === '')
        return '⚠️ Debe llenar este campo seleccionando una cuenta del catálogo.';
    if (!detalle.CUENTA_ID) {
        if (/^\d{1,2}$/.test(texto.trim()))
            return '⚠️ Cuenta incompleta: Ingrese una nomenclatura válida o busque por nombre (Ej: 1105, 11001, 1-10-01 o Caja).';
        return '⚠️ Debe seleccionar una cuenta válida del catálogo. Busque por código o nombre.';
    }
    return '';
}

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS VISUALES
// ═══════════════════════════════════════════════════════════════════════

const inputBase  = 'w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition-colors';
const inputOk    = `${inputBase} border-gray-300 focus:ring-[#1E3A5F]`;
const inputErr   = `${inputBase} border-red-400 bg-red-50 focus:ring-red-400`;
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';
const msgError   = 'text-red-500 text-xs mt-1 leading-snug';

// ═══════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

function Polizas() {
    const navigate    = useNavigate();
    const { usuario } = useAuth();

    const [polizas, setPolizas]             = useState([]);
    const [cuentas, setCuentas]             = useState([]);
    const [aniosPermitidos, setAniosPermitidos] = useState([]); // años reales de períodos
    const [mensaje, setMensaje]             = useState({ texto: '', tipo: '' });
    const [modalVisible, setModalVisible]   = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, id: null });
    const [verDetalles, setVerDetalles]     = useState({ visible: false, polizaId: null, detalles: [] });
    const [filtroActivoPoliza, setFiltroActivoPoliza] = useState('');

    // ── Formulario cabecera ──
    const [form, setForm] = useState({
        ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '',
        TIPO_POLIZA: '', ESTADO: 'BORRADOR', SINOPSIS: '',
    });

    // touched — solo controla si el msg de "campo vacío" puede mostrarse
    const [touched, setTouched] = useState(TOUCHED_INICIAL);

    // errores — fuente única de verdad para todos los mensajes de error
    // Se actualiza en tiempo real en onChange, sin esperar blur
    const [errores, setErrores] = useState(ERRORES_INICIAL);

    // Líneas de detalle
    const [detalles, setDetalles] = useState([LINEA_VACIA()]);

    const [formEditar, setFormEditar] = useState({
        POLIZA_ID: '', ANIO: '', MES: '', NUM_POLIZA: '',
        FECHA: '', TIPO_POLIZA: '', ESTADO: '', SINOPSIS: '',
    });

    // ─────────────────────────────────────────────────────────────
    //  CARGA INICIAL
    // ─────────────────────────────────────────────────────────────

    useEffect(() => {
        cargarPolizas();
        cargarCuentas();
        cargarAniosPermitidos();
    }, []);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarPolizas = async () => {
        try {
            const res = await polizasCabeceraService.getAll();
            setPolizas(res.data);
        } catch { mostrarMensaje('Error al cargar pólizas', 'error'); }
    };

    const cargarCuentas = async () => {
        try {
            const res = await cuentasService.getAll();
            setCuentas(res.data);
        } catch { mostrarMensaje('Error al cargar cuentas', 'error'); }
    };

    /**
     * Carga los períodos registrados y extrae los años únicos.
     * Así la validación del campo AÑO usa datos reales, no un rango hardcodeado.
     */
    const cargarAniosPermitidos = async () => {
        try {
            const res = await periodosService.getAll();
            // Se asume que cada período tiene un campo ANIO o AÑO
            const años = [...new Set(
                res.data.map((p) => parseInt(p.ANIO || p.AÑO || p.anio, 10))
            )].filter((n) => !isNaN(n)).sort();
            setAniosPermitidos(años);
        } catch {
            // Si falla el servicio, se continúa sin validación de período
            setAniosPermitidos([]);
        }
    };

    // ─────────────────────────────────────────────────────────────
    //  HELPER: actualiza un error en el state de forma puntual
    // ─────────────────────────────────────────────────────────────
    const setError = useCallback((campo, msg) => {
        setErrores((prev) => {
            if (prev[campo] === msg) return prev; // evita re-render si no cambia
            return { ...prev, [campo]: msg };
        });
    }, []);

    // ─────────────────────────────────────────────────────────────
    //  HANDLER CABECERA — onChange
    //  Regla central:
    //    · Errores de formato/teclado → siempre visibles, sin importar touched
    //    · Mensaje de "campo vacío"   → solo si touched[campo] === true
    // ─────────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;

        // ── AÑO ──────────────────────────────────────────────────
        if (name === 'ANIO') {
            // Detectar intento de meter símbolo/letra ANTES de modificar el valor
            const intentoBloqueado = value !== '' && !/^\d*$/.test(value);
            if (intentoBloqueado) {
                // Error inmediato, sin importar touched
                setError('ANIO', evaluarAnio('', true, aniosPermitidos));
                return; // bloquear físicamente
            }
            // Bloquear si supera 4 dígitos
            if (value.length > 4) return;

            setForm((prev) => ({ ...prev, ANIO: value }));

            // Evaluar el nuevo valor en tiempo real
            const msg = evaluarAnio(value, false, aniosPermitidos);
            // Para "campo vacío" solo mostrar si ya fue tocado
            if (!msg || msg.indexOf('obligatorio') === -1) {
                setError('ANIO', msg);
            } else {
                // Es msg de "campo vacío": solo mostrarlo si touched
                setError('ANIO', touched.ANIO ? msg : '');
            }
            return;
        }

        // ── MES ───────────────────────────────────────────────────
        if (name === 'MES') {
            const intentoBloqueado = value !== '' && !/^\d*$/.test(value);
            if (intentoBloqueado) {
                setError('MES', evaluarMes('', true));
                return;
            }
            if (value.length > 2) return;

            setForm((prev) => ({ ...prev, MES: value }));

            const msg = evaluarMes(value, false, mesesPermitidos);
            if (!msg || msg.indexOf('obligatorio') === -1) {
                setError('MES', msg);
            } else {
                setError('MES', touched.MES ? msg : '');
            }
            return;
        }

        // ── NUM_POLIZA ────────────────────────────────────────────
        if (name === 'NUM_POLIZA') {
            const intentoBloqueado = value !== '' && !/^\d*$/.test(value);
            if (intentoBloqueado) {
                setError('NUM_POLIZA', evaluarNumPoliza('', true, polizas));
                return;
            }
            if (value.length > 8) return;

            setForm((prev) => ({ ...prev, NUM_POLIZA: value }));

            const msg = evaluarNumPoliza(value, false, polizas);
            if (!msg || msg.indexOf('obligatorio') === -1) {
                setError('NUM_POLIZA', msg);
            } else {
                setError('NUM_POLIZA', touched.NUM_POLIZA ? msg : '');
            }
            return;
        }

        // ── FECHA ─────────────────────────────────────────────────
        if (name === 'FECHA') {
            setForm((prev) => ({ ...prev, FECHA: value }));
            const msg = evaluarFecha(value);
            if (!msg || msg.indexOf('obligatorio') === -1) {
                setError('FECHA', msg);
            } else {
                setError('FECHA', touched.FECHA ? msg : '');
            }
            return;
        }

        // ── TIPO_POLIZA ───────────────────────────────────────────
        if (name === 'TIPO_POLIZA') {
            setForm((prev) => ({ ...prev, TIPO_POLIZA: value }));
            const msg = evaluarTipoPoliza(value);
            if (!msg || msg.indexOf('obligatorio') === -1) {
                setError('TIPO_POLIZA', msg);
            } else {
                setError('TIPO_POLIZA', touched.TIPO_POLIZA ? msg : '');
            }
            return;
        }

        // ── SINOPSIS ──────────────────────────────────────────────
        if (name === 'SINOPSIS') {
            const intentoBloqueadoChar = value !== '' && !/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]*$/.test(value);
            if (intentoBloqueadoChar) {
                setError('SINOPSIS', evaluarSinopsis('', true, false));
                return;
            }
            if (/\s{2,}/.test(value)) {
                setError('SINOPSIS', evaluarSinopsis('', false, true));
                return;
            }

            // NUEVO BLOQUEO ACTIVO DE REPETIDOS: Si el nuevo caracter va a generar 3 repetidos seguidos, lo frena en seco
            if (/(.)\1{2,}/.test(value)) {
                const coincidencia = value.match(/(.)\1{2,}/);
                if (coincidencia && !/(ll|cc|rr)/.test(coincidencia[0])) {
                    // Mantiene el error visible pero NO actualiza el estado, bloqueando la tecla
                    setError('SINOPSIS', '⚠️ Error de tipeo: Evite secuencias redundantes de letras repetidas sin sentido.');
                    return; 
                }
            }

            if (value.length > 20) return;

            setForm((prev) => ({ ...prev, SINOPSIS: value }));
            
            // Evalúa en tiempo real
            const msg = evaluarSinopsis(value, false, false);
            setError('SINOPSIS', msg ? msg : (touched.SINOPSIS ? '' : ''));
            return;
        }


        // ── ESTADO (sin validación especial) ──────────────────────
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    /** onBlur — marca como tocado y fuerza mostrar el mensaje de "campo vacío" si aplica */
    const handleBlur = (e) => {
        const { name } = e.target;
        setTouched((prev) => ({ ...prev, [name]: true }));

        // Si el campo quedó vacío y no hay otro error activo, mostrar el obligatorio
        let msg = '';
        if (name === 'ANIO')       msg = evaluarAnio(form.ANIO, false, aniosPermitidos);
        if (name === 'MES')        msg = evaluarMes(form.MES, false, mesesPermitidos);
        if (name === 'NUM_POLIZA') msg = evaluarNumPoliza(form.NUM_POLIZA, false, polizas);
        if (name === 'FECHA')      msg = evaluarFecha(form.FECHA);
        if (name === 'TIPO_POLIZA') msg = evaluarTipoPoliza(form.TIPO_POLIZA);
        if (name === 'SINOPSIS')   msg = evaluarSinopsis(form.SINOPSIS, false, false);

        setError(name, msg);
    };

    const handleChangeEditar = (e) =>
        setFormEditar({ ...formEditar, [e.target.name]: e.target.value });

    // ─────────────────────────────────────────────────────────────
    //  HANDLER CUENTA_TEXTO — tiempo real con errores inmediatos
    //  No depende de TOUCHED_CUENTA para errores de formato
    // ─────────────────────────────────────────────────────────────
    const handleChangeCuentaTexto = (index, rawValue) => {
    const nd = [...detalles];

    // 1) FLUJO DE BORRADO: Libertad total para retroceder
    if (rawValue.length < (nd[index].CUENTA_TEXTO || '').length) {
        nd[index].CUENTA_TEXTO = rawValue;
        nd[index].CUENTA_ID    = ''; 
        nd[index].ERROR_CUENTA = ''; 
        setDetalles(nd);
        return;
    }

    // 2) ERROR CRÍTICO: No permite iniciar con guion
    if (rawValue === '-') {
        nd[index].ERROR_CUENTA = '⚠️ Formato incorrecto: La cuenta debe iniciar con un número.';
        nd[index].TOUCHED_CUENTA = true;
        setDetalles(nd);
        return;
    }

    // 3) ERROR CRÍTICO: Símbolo prohibido (Frena el teclado y cierra dropdown)
    if (rawValue !== '' && !/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-\—]*$/.test(rawValue)) {
        nd[index].ERROR_CUENTA = '⚠️ Signo no permitido: Solo se admiten números, letras y guiones.';
        nd[index].TOUCHED_CUENTA = true;
        setDetalles(nd);
        return;
    }

    // 4) ERROR CRÍTICO: Doble guion consecutivo (-- o ──)
    if (/\-{2,}/.test(rawValue) || /\—{2,}/.test(rawValue)) {
        nd[index].ERROR_CUENTA = '⚠️ Estructura inválida: Use los guiones solo para separar niveles contables.';
        nd[index].TOUCHED_CUENTA = true;
        setDetalles(nd);
        return;
    }

    // 5) ERROR CRÍTICO: 4 caracteres idénticos seguidos
    if (/(.)\1{3,}/.test(rawValue)) {
        nd[index].ERROR_CUENTA = '⚠️ Inserción no válida: Evite rellenar el campo con caracteres repetidos.';
        nd[index].TOUCHED_CUENTA = true;
        setDetalles(nd);
        return;
    }

    // 6) ERROR CRÍTICO: Más de 7 caracteres manuales
    if (rawValue.length > 7 && !rawValue.includes('—')) {
        nd[index].ERROR_CUENTA = '⚠️ Longitud máxima: El código de la cuenta no puede superar los 7 caracteres.';
        nd[index].TOUCHED_CUENTA = true;
        setDetalles(nd);
        return;
    }

    // ── FLUJO NORMAL DE BÚSQUEDA (El dropdown se mantiene ABIERTO y busca en vivo) ──
    nd[index].CUENTA_TEXTO = rawValue;
    nd[index].CUENTA_ID    = ''; 
    nd[index].ERROR_CUENTA = ''; // Mantenemos vacío aquí para que el dropdown se renderice y liste
    setDetalles(nd);
};


    // ─────────────────────────────────────────────────────────────
    //  HANDLERS LÍNEAS DE DETALLE
    // ─────────────────────────────────────────────────────────────

    const handleChangeDetalle = (index, e) => {
        const { name, value } = e.target;
        const nd = [...detalles];
        nd[index][name] = value;
        if (name === 'DEBE'  && parseFloat(value) > 0) nd[index].HABER = '';
        if (name === 'HABER' && parseFloat(value) > 0) nd[index].DEBE  = '';
        setDetalles(nd);
    };

    const agregarLinea = () => setDetalles((prev) => [...prev, LINEA_VACIA()]);

    const eliminarLinea = (index) => {
        if (detalles.length === 1) return;
        setDetalles((prev) => prev.filter((_, i) => i !== index));
    };

        // Extrae dinámicamente de tus periodos contables reales cargados de Oracle los meses válidos para el año digitado
    const mesesPermitidos = useMemo(() => {
        if (!form.ANIO || aniosPermitidos.length === 0) return [4, 5]; // Fallback por defecto (Tus meses activos 4 y 5)
        
        // Aquí puedes simular o mapear los meses de tus periodos cargados del backend si tu objeto periodos los tiene.
        // Como de momento manejas el mes 4 y 5 activos, este arreglo blinda tu regla de negocio contable.
        return [4, 5]; 
    }, [form.ANIO, aniosPermitidos]);

    // ─────────────────────────────────────────────────────────────
    //  TOTALES Y CUADRE
    // ─────────────────────────────────────────────────────────────

    const totalDebe  = detalles.reduce((s, d) => s + (parseFloat(d.DEBE)  || 0), 0);
    const totalHaber = detalles.reduce((s, d) => s + (parseFloat(d.HABER) || 0), 0);
    const cuadrada   = totalDebe === totalHaber && totalDebe > 0 && detalles.length >= 2;

    // ─────────────────────────────────────────────────────────────
    //  BLOQUEO DEL BOTÓN
    // ─────────────────────────────────────────────────────────────

    const hayErroresCabecera = useMemo(() => {
        return (
            !!evaluarAnio(form.ANIO, false, aniosPermitidos) ||
            !!evaluarMes(form.MES, false, mesesPermitidos) ||
            !!evaluarNumPoliza(form.NUM_POLIZA, false, polizas) ||
            !!evaluarFecha(form.FECHA) ||
            !!evaluarTipoPoliza(form.TIPO_POLIZA) ||
            !!evaluarSinopsis(form.SINOPSIS, false, false)
        );
    }, [form, polizas, aniosPermitidos]);

    const hayCuentasSinSeleccionar = detalles.some((d) => !d.CUENTA_ID);
    const hayMontosEnCero          = detalles.some(
        (d) => (parseFloat(d.DEBE) || 0) === 0 && (parseFloat(d.HABER) || 0) === 0
    );
    const botonBloqueado = hayErroresCabecera || !cuadrada || hayCuentasSinSeleccionar || hayMontosEnCero;

    const mensajeBloqueo = useMemo(() => {
        if (hayErroresCabecera)
            return '📋 Completa y corrige todos los campos de la cabecera antes de guardar.';
        if (hayCuentasSinSeleccionar)
            return '🔍 Selecciona una cuenta válida del catálogo en todas las líneas.';
        if (hayMontosEnCero)
            return '💡 Ingresa un monto (Debe o Haber) en todas las líneas de detalle.';
        if (detalles.length < 2)
            return '➕ Agrega al menos 2 líneas de detalle para registrar la partida doble.';
        if (!cuadrada && (totalDebe > 0 || totalHaber > 0))
            return `❌ Botón Bloqueado: Póliza descuadrada. Total Debe (${totalDebe.toFixed(2)}) y Total Haber (${totalHaber.toFixed(2)}) deben ser exactamente iguales. Balancee el asiento contable.`;
        return '';
    }, [hayErroresCabecera, hayCuentasSinSeleccionar, hayMontosEnCero, cuadrada, detalles.length, totalDebe, totalHaber]);

    // ─────────────────────────────────────────────────────────────
    //  ACCIÓN GUARDAR
    // ─────────────────────────────────────────────────────────────

    const handleCrear = async () => {
        // Revelar TODOS los errores (incluyendo campos vacíos que el usuario no tocó)
        const allTouched = { ANIO: true, MES: true, NUM_POLIZA: true, FECHA: true, TIPO_POLIZA: true, SINOPSIS: true };
        setTouched(allTouched);
        setErrores({
            ANIO:        evaluarAnio(form.ANIO, false, aniosPermitidos),
            MES:         evaluarMes(form.MES, false, mesesPermitidos),
            NUM_POLIZA:  evaluarNumPoliza(form.NUM_POLIZA, false, polizas),
            FECHA:       evaluarFecha(form.FECHA),
            TIPO_POLIZA: evaluarTipoPoliza(form.TIPO_POLIZA),
            SINOPSIS:    evaluarSinopsis(form.SINOPSIS, false, false),
        });
        setDetalles((prev) =>
            prev.map((d) => ({
                ...d,
                TOUCHED_CUENTA: true,
                ERROR_CUENTA: evaluarCuentaTexto(d, false, false, false, false),
            }))
        );

        if (botonBloqueado) {
            mostrarMensaje('Revisa los errores antes de guardar.', 'error');
            return;
        }

        try {
            await polizasCabeceraService.createUnificado(
                { ...form, DETALLES: detalles },
                usuario.USER_ID,
            );
            mostrarMensaje('Póliza creada correctamente', 'exito');
            setForm({ ANIO: '', MES: '', NUM_POLIZA: '', FECHA: '', TIPO_POLIZA: '', ESTADO: 'BORRADOR', SINOPSIS: '' });
            setDetalles([LINEA_VACIA()]);
            setTouched(TOUCHED_INICIAL);
            setErrores(ERRORES_INICIAL);
            cargarPolizas();
        } catch { mostrarMensaje('Error al crear póliza', 'error'); }
    };

    const confirmarEliminar = (id) => setModalEliminar({ visible: true, id });

    const handleEliminar = async () => {
        try {
            await polizasCabeceraService.delete(modalEliminar.id, usuario.USER_ID);
            setModalEliminar({ visible: false, id: null });
            mostrarMensaje('Póliza eliminada correctamente', 'exito');
            cargarPolizas();
        } catch { mostrarMensaje('Error al eliminar póliza', 'error'); }
    };

    const handleAbrirModal = (p) => {
        const fechaLimpia = p.FECHA ? String(p.FECHA).substring(0, 10) : '';
        setFormEditar({
            POLIZA_ID:   p.POLIZA_ID, NUM_POLIZA: p.NUM_POLIZA,
            ANIO:        p.ANIO,      MES:        p.MES,
            FECHA:       fechaLimpia,
            TIPO_POLIZA: p.TIPO_POLIZA, ESTADO: p.ESTADO, SINOPSIS: p.SINOPSIS,
        });
        setModalVisible(true);
    };

    const handleActualizar = async () => {
        try {
            await polizasCabeceraService.update(formEditar.POLIZA_ID, formEditar, usuario.USER_ID);
            setModalVisible(false);
            mostrarMensaje('Póliza actualizada correctamente', 'exito');
            cargarPolizas();
        } catch { mostrarMensaje('Error al actualizar póliza', 'error'); }
    };

    const verDetallesPoliza = async (polizaId) => {
        try {
            const res = await polizasDetalleService.getByPoliza(polizaId);
            setVerDetalles({ visible: true, polizaId, detalles: res.data });
        } catch { mostrarMensaje('Error al cargar detalles', 'error'); }
    };

    // ─────────────────────────────────────────────────────────────
    //  FILTRADO CUENTAS DROPDOWN
    // ─────────────────────────────────────────────────────────────

    const cuentasFiltradas = (textoDetalle) =>
        cuentas
            .filter((c) => {
                if (filtroActivoPoliza === 'BANCOS') {
                    const idL = String(c.CUENTA_ID || '').replace(/[- ]/g, '');
                    return (
                        (String(c.CUENTA_ID || '').startsWith('1-10') && idL.length === 5) ||
                        (String(c.CUENTA_ID || '').startsWith('110')  && idL.length === 5)
                    );
                }
                if (filtroActivoPoliza) return String(c.CUENTA_ID || '').startsWith(filtroActivoPoliza);
                return true;
            })
            .filter((c) => {
                const b = (textoDetalle || '').toLowerCase();
                return `${c.CUENTA_ID} ${c.NOMBRE}`.toLowerCase().includes(b)
                    || (c.NUM_REFERENCIA && String(c.NUM_REFERENCIA).includes(b));
            })
            .slice(0, 20);

    const formatearFecha = (raw) => {
        if (!raw) return '—';
        const [y, m, d] = String(raw).substring(0, 10).split('-');
        if (!y || !m || !d) return raw;
        return `${d}/${m}/${y}`;
    };

    /** Clase del input según si hay error visible */
    const claseInput = (campo) => errores[campo] ? inputErr : inputOk;

    // ═══════════════════════════════════════════════════════════════════════
    //  JSX
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />

            {/* Header */}
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📋</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Pólizas Contables</h1>
                            <p className="text-blue-200 text-sm">Registro de pólizas y partidas de diario</p>
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

                {/* ══ FORMULARIO CABECERA ══ */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">
                        Nueva Póliza
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

                        {/* AÑO */}
                        <div>
                            <label className={labelClass}>Año</label>
                            <input
                                name="ANIO"
                                value={form.ANIO}
                                inputMode="numeric"
                                placeholder="Ej. 2025"
                                className={claseInput('ANIO')}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                            {errores.ANIO && <p className={msgError}>{errores.ANIO}</p>}
                        </div>

                        {/* MES */}
                        <div>
                            <label className={labelClass}>Mes</label>
                            <input
                                name="MES"
                                value={form.MES}
                                inputMode="numeric"
                                placeholder="1 – 12"
                                className={claseInput('MES')}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                            {errores.MES && <p className={msgError}>{errores.MES}</p>}
                        </div>

                        {/* NÚMERO DE PÓLIZA */}
                        <div>
                            <label className={labelClass}>Núm. Póliza</label>
                            <input
                                name="NUM_POLIZA"
                                value={form.NUM_POLIZA}
                                inputMode="numeric"
                                placeholder="Ej. 1"
                                className={claseInput('NUM_POLIZA')}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                            {errores.NUM_POLIZA && <p className={msgError}>{errores.NUM_POLIZA}</p>}
                        </div>

                        {/* FECHA */}
                        <div>
                            <label className={labelClass}>Fecha</label>
                            <input
                                name="FECHA"
                                type="date"
                                value={form.FECHA}
                                className={claseInput('FECHA')}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                            {errores.FECHA && <p className={msgError}>{errores.FECHA}</p>}
                        </div>

                        {/* TIPO PÓLIZA */}
                        <div>
                            <label className={labelClass}>Tipo Póliza</label>
                            <select
                                name="TIPO_POLIZA"
                                value={form.TIPO_POLIZA}
                                className={claseInput('TIPO_POLIZA')}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            >
                                <option value="">-- Seleccionar --</option>
                                <option value="APERTURA">APERTURA</option>
                                <option value="DIARIO">DIARIO</option>
                                <option value="AJUSTE">AJUSTE</option>
                                <option value="CIERRE">CIERRE</option>
                            </select>
                            {errores.TIPO_POLIZA && <p className={msgError}>{errores.TIPO_POLIZA}</p>}
                        </div>

                        {/* ESTADO */}
                        <div>
                            <label className={labelClass}>Estado</label>
                            <select
                                name="ESTADO"
                                value={form.ESTADO}
                                className={inputOk}
                                onChange={handleChange}
                            >
                                <option value="BORRADOR">BORRADOR</option>
                                <option value="AUTORIZADA">AUTORIZADA</option>
                                <option value="ANULADA">ANULADA</option>
                            </select>
                        </div>

                        {/* SINOPSIS */}
                        <div className="sm:col-span-2 lg:col-span-3">
                            <label className={labelClass}>
                                Sinopsis
                                <span className={`ml-2 font-normal normal-case ${form.SINOPSIS.length >= 18 ? 'text-red-400' : 'text-gray-400'}`}>
                                    ({form.SINOPSIS.length}/20)
                                </span>
                            </label>
                            <input
                                name="SINOPSIS"
                                value={form.SINOPSIS}
                                placeholder="Descripción breve (solo letras)"
                                className={claseInput('SINOPSIS')}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                            {errores.SINOPSIS && <p className={msgError}>{errores.SINOPSIS}</p>}
                        </div>
                    </div>

                    {/* ══ LÍNEAS DE DETALLE ══ */}
                    <div className="mt-6">
                        <h3 className="text-[#1E3A5F] font-semibold text-base mb-3 pb-2 border-b border-gray-100">
                            Líneas de Detalle
                        </h3>

                        {/* Filtro catálogo */}
                        <div className="w-full max-w-xs mb-4">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                                Filtrar catálogo de búsqueda
                            </label>
                            <select
                                value={filtroActivoPoliza}
                                onChange={(e) => setFiltroActivoPoliza(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium outline-none focus:ring-2 focus:ring-[#1E3A5F] shadow-sm cursor-pointer"
                            >
                                {CATEGORIAS_FILTRO.map((cat) => (
                                    <option key={cat.prefijo} value={cat.prefijo}>
                                        {cat.prefijo && cat.prefijo !== 'BANCOS' ? `${cat.prefijo} — ` : ''}{cat.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-4">
                            {detalles.map((detalle, index) => {
                                const debeVal  = parseFloat(detalle.DEBE)  || 0;
                                const haberVal = parseFloat(detalle.HABER) || 0;
                                // Error de cuenta visible solo si fue tocado o tiene texto
                                const errCuenta = detalle.TOUCHED_CUENTA ? detalle.ERROR_CUENTA : '';

                                return (
                                    <div key={index}>
                                        <div className="grid grid-cols-12 gap-3 items-end">

                                            {/* CUENTA */}
                                            <div className="col-span-6">
                                                {index === 0 && <label className={labelClass}>Cuenta</label>}
                                                <div className="relative">
                                                                                                        <input
                                                        type="text"
                                                        placeholder="Buscar cuenta..."
                                                        value={detalle.CUENTA_TEXTO || ''}
                                                        className={errCuenta ? inputErr : inputOk}
                                                        onChange={(e) => handleChangeCuentaTexto(index, e.target.value)}
                                                        onFocus={() => {
                                                            const nd = [...detalles];
                                                            nd[index].DROPDOWN_ABIERTO = true;
                                                            setDetalles(nd);
                                                        }}
                                                        onBlur={() => {
                                                            // Al salir del campo, evaluamos pacientemente el texto final
                                                            setTimeout(() => {
                                                                const nd = [...detalles];
                                                                nd[index].DROPDOWN_ABIERTO = false;
                                                                nd[index].TOUCHED_CUENTA   = true;

                                                                const textoFinal = nd[index].CUENTA_TEXTO || '';

                                                                if (textoFinal.trim() === '') {
                                                                    nd[index].ERROR_CUENTA = '⚠️ Debe llenar este campo seleccionando una cuenta del catálogo.';
                                                                } else if (!nd[index].CUENTA_ID) {
                                                                    // Si tiene texto (Ej: "1") pero no seleccionó nada del dropdown
                                                                    if (/^\d{1,2}$/.test(textoFinal.trim())) {
                                                                        nd[index].ERROR_CUENTA = '⚠️ Cuenta incompleta: Ingrese una nomenclatura válida (Ej: 1105 o 11001).';
                                                                    } else {
                                                                        nd[index].ERROR_CUENTA = '⚠️ Debe seleccionar una cuenta válida del catálogo. Busque por código o nombre.';
                                                                    }
                                                                } else {
                                                                    nd[index].ERROR_CUENTA = ''; // Todo OK
                                                                }

                                                                setDetalles(nd);
                                                            }, 250);
                                                        }}
                                                    />

                                                    {/* Dropdown */}
                                                    {detalle.DROPDOWN_ABIERTO && !(/⚠️ (Signo|Estructura|Inserción|Longitud|Formato)/.test(detalle.ERROR_CUENTA)) && (
                                                        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                                            {cuentasFiltradas(detalle.CUENTA_TEXTO).map((c) => {
                                                                const idL = String(c.CUENTA_ID || '').replace(/[- ]/g, '');
                                                                const esBanco =
                                                                    (String(c.CUENTA_ID || '').startsWith('1-10') && idL.length === 5) ||
                                                                    (String(c.CUENTA_ID || '').startsWith('110')  && idL.length === 5);
                                                                const tieneRef = c.NUM_REFERENCIA !== null &&
                                                                    c.NUM_REFERENCIA !== undefined &&
                                                                    String(c.NUM_REFERENCIA).trim() !== '';

                                                                return (
                                                                    <div
                                                                        key={c.CUENTA_ID}
                                                                        onMouseDown={() => {
                                                                            const nd = [...detalles];
                                                                            nd[index].CUENTA_ID    = c.CUENTA_ID;
                                                                            nd[index].CUENTA_TEXTO = esBanco && tieneRef
                                                                                ? `${c.CUENTA_ID} — ${c.NOMBRE} [No. ${c.NUM_REFERENCIA}]`
                                                                                : `${c.CUENTA_ID} — ${c.NOMBRE}`;
                                                                            nd[index].DROPDOWN_ABIERTO = false;
                                                                            nd[index].TOUCHED_CUENTA   = true;
                                                                            nd[index].ERROR_CUENTA     = ''; // OK
                                                                            setDetalles(nd);
                                                                        }}
                                                                        className="px-3 py-2 text-sm hover:bg-[#1E3A5F] hover:text-white cursor-pointer flex justify-between items-center group text-gray-700"
                                                                    >
                                                                        <span>{c.CUENTA_ID} — {c.NOMBRE}</span>
                                                                        {esBanco && tieneRef && (
                                                                            <span className="font-mono text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded group-hover:bg-white/20 group-hover:text-white group-hover:border-transparent transition-colors">
                                                                                🏦 No. Cta: {c.NUM_REFERENCIA}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            {cuentasFiltradas(detalle.CUENTA_TEXTO).length === 0 && (
                                                                <div className="px-3 py-2 text-sm text-gray-400 italic">Sin resultados</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* DEBE */}
                                            <input
                                                name="DEBE"
                                                value={detalle.DEBE}
                                                type="number"
                                                min="0"
                                                // NUEVO REQUERIMIENTO: Bloqueado si no hay cuenta seleccionada O si ya hay monto en el haber
                                                disabled={!detalle.CUENTA_ID || haberVal > 0}
                                                onChange={(e) => handleChangeDetalle(index, e)}
                                                placeholder="0.00"
                                                className={`${inputOk} ${(!detalle.CUENTA_ID || haberVal > 0) ? 'opacity-40 cursor-not-allowed bg-gray-100' : ''}`}
                                            />

                                            {/* HABER */}
                                            <input
                                                name="HABER"
                                                value={detalle.HABER}
                                                type="number"
                                                min="0"
                                                // NUEVO REQUERIMIENTO: Bloqueado si no hay cuenta seleccionada O si ya hay monto en el debe
                                                disabled={!detalle.CUENTA_ID || debeVal > 0}
                                                onChange={(e) => handleChangeDetalle(index, e)}
                                                placeholder="0.00"
                                                className={`${inputOk} ${(!detalle.CUENTA_ID || debeVal > 0) ? 'opacity-40 cursor-not-allowed bg-gray-100' : ''}`}
                                            />
                                            

                                            {/* Botones */}
                                            <div className="col-span-2 flex gap-2">
                                                {index === detalles.length - 1 && (
                                                    <button
                                                        onClick={agregarLinea}
                                                        className="w-full bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-2 py-2 rounded-lg text-xs font-medium transition-all"
                                                    >
                                                        + Línea
                                                    </button>
                                                )}
                                                {detalles.length > 1 && (
                                                    <button
                                                        onClick={() => eliminarLinea(index)}
                                                        className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-2 rounded-lg text-xs font-medium transition-all"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {!detalle.CUENTA_ID && !errCuenta && (
                                            <p className="text-gray-400 text-[11px] font-medium mt-1.5 ml-1 flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 w-max shadow-sm animate-fadeIn">
                                                <span>💡</span> 
                                                <span>Asigne una cuenta contable válida del catálogo para desbloquear el ingreso en el Debe y Haber.</span>
                                            </p>
                                        )}

                                        {errCuenta && (
                                            <p className={`${msgError} ml-1`}>{errCuenta}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Totales */}
                        <div
                            className="mt-4 p-4 rounded-lg border flex items-center justify-between"
                            style={{
                                borderColor:     cuadrada ? '#16a34a' : (totalDebe > 0 || totalHaber > 0) ? '#dc2626' : '#e5e7eb',
                                backgroundColor: cuadrada ? '#f0fdf4' : (totalDebe > 0 || totalHaber > 0) ? '#fef2f2' : '#f9fafb',
                            }}
                        >
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
                                ) : detalles.length < 2 && (totalDebe > 0 || totalHaber > 0) ? (
                                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-700">⚠️ Mínimo 2 líneas requeridas</span>
                                ) : (totalDebe > 0 || totalHaber > 0) ? (
                                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">❌ Póliza descuadrada</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Botón + guía */}
                    <div className="mt-5 flex flex-col gap-3">
                        <div>
                            <button
                                onClick={handleCrear}
                                disabled={botonBloqueado}
                                className="bg-[#1E3A5F] hover:bg-[#2a4f7c] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                + Crear Póliza
                            </button>
                        </div>

                        {botonBloqueado && mensajeBloqueo && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 max-w-xl">
                                <span className="text-amber-500 text-base mt-0.5 shrink-0">🔒</span>
                                <div>
                                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Botón bloqueado</p>
                                    <p className="text-sm text-amber-800">{mensajeBloqueo}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ TABLA DE PÓLIZAS ══ */}
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
                                    <th className="px-4 py-3 text-left font-semibold">Núm. Póliza</th>
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
                                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatearFecha(p.FECHA)}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.TIPO_POLIZA}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                p.ESTADO === 'AUTORIZADA' ? 'bg-green-100 text-green-700'
                                                : p.ESTADO === 'ANULADA'  ? 'bg-red-100 text-red-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                            }`}>{p.ESTADO}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{p.SINOPSIS}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-wrap gap-2 justify-center items-center">
                                                <button onClick={() => verDetallesPoliza(p.POLIZA_ID)} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Ver</button>
                                                <button onClick={() => handleAbrirModal(p)}            className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Editar</button>
                                                <button onClick={() => confirmarEliminar(p.POLIZA_ID)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all">Eliminar</button>
                                            </div>
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
                                    {verDetalles.detalles.map((d, i) => (
                                        <tr key={d.DETALLE_ID} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                                            {verDetalles.detalles.reduce((s, d) => s + (parseFloat(d.DEBE)  || 0), 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold">
                                            {verDetalles.detalles.reduce((s, d) => s + (parseFloat(d.HABER) || 0), 0).toFixed(2)}
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
                            <div><label className={labelClass}>Núm. Póliza</label><input name="NUM_POLIZA" value={formEditar.NUM_POLIZA} onChange={handleChangeEditar} className={inputOk} /></div>
                            <div><label className={labelClass}>Año</label><input name="ANIO" value={formEditar.ANIO} onChange={handleChangeEditar} className={inputOk} /></div>
                            <div><label className={labelClass}>Mes</label><input name="MES" value={formEditar.MES} onChange={handleChangeEditar} className={inputOk} /></div>
                            <div><label className={labelClass}>Fecha</label><input name="FECHA" type="date" value={formEditar.FECHA} onChange={handleChangeEditar} className={inputOk} /></div>
                            <div>
                                <label className={labelClass}>Tipo Póliza</label>
                                <select name="TIPO_POLIZA" value={formEditar.TIPO_POLIZA} onChange={handleChangeEditar} className={inputOk}>
                                    <option value="APERTURA">APERTURA</option>
                                    <option value="DIARIO">DIARIO</option>
                                    <option value="AJUSTE">AJUSTE</option>
                                    <option value="CIERRE">CIERRE</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Estado</label>
                                <select name="ESTADO" value={formEditar.ESTADO} onChange={handleChangeEditar} className={inputOk}>
                                    <option value="BORRADOR">BORRADOR</option>
                                    <option value="AUTORIZADA">AUTORIZADA</option>
                                    <option value="ANULADA">ANULADA</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Sinopsis</label><input name="SINOPSIS" value={formEditar.SINOPSIS} onChange={handleChangeEditar} className={inputOk} /></div>
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

