import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useState, useMemo, useCallback, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import reportesService from '../services/reportesServices';
import Toast from './Toast';

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
const fmt = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtFecha = (raw) => {
    if (!raw) return '';
    const parte = String(raw).substring(0, 10);
    const [y, m, d] = parte.split('-');
    if (!y || !m || !d) return raw;
    return `${d}/${m}/${y}`;
};

const obtenerLeyendaPeriodo = () => {
    if (tipoFiltro === 'MES') return `${MESES.find(m => m.value === periodo.mes)?.label} ${periodo.anio}`;
    if (tipoFiltro === 'ANIO') return `Año Fiscal Completo: ${periodo.anio}`;
    if (tipoFiltro === 'RANGO') return `Rango Personalizado: ${fechaDesde ? fmtFecha(fechaDesde) : '...'} al ${fechaHasta ? fmtFecha(fechaHasta) : '...'}`;
    return 'Historial Contable Completo';
};


const MESES = [
    { value: 1,  label: 'Enero' },
    { value: 2,  label: 'Febrero' },
    { value: 3,  label: 'Marzo' },
    { value: 4,  label: 'Abril' },
    { value: 5,  label: 'Mayo' },
    { value: 6,  label: 'Junio' },
    { value: 7,  label: 'Julio' },
    { value: 8,  label: 'Agosto' },
    { value: 9,  label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
];

// ─────────────────────────────────────────────
// SUB-COMPONENTES REUTILIZABLES
// ─────────────────────────────────────────────

const FilaCuenta = ({ cuenta, nombre, saldo, negativo = false }) => (
    <div className="flex items-center justify-between py-1.5 pl-8 pr-2 hover:bg-slate-50 border-b border-dashed border-slate-100">
        <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 w-16 shrink-0">{cuenta}</span>
            <span className="text-sm text-slate-700">{nombre}</span>
        </div>
        <span className={`text-sm font-mono tabular-nums ${negativo ? 'text-red-600' : 'text-slate-800'}`}>
            {negativo ? `(${fmt(Math.abs(saldo))})` : fmt(Math.abs(saldo))}
        </span>
    </div>
);

const FilaTotal = ({ label, valor, nivel = 1, negativo = false, doubleLine = false }) => {
    const estilos = {
        1: 'font-semibold text-slate-700 bg-slate-50 border-t border-slate-300',
        2: 'font-bold text-slate-800 bg-slate-100 border-t-2 border-slate-400',
        3: `font-extrabold text-white ${negativo ? 'bg-red-700' : 'bg-[#1E3A5F]'} text-base`,
    };
    return (
        <div className={`flex items-center justify-between px-4 py-2.5 ${estilos[nivel]} ${doubleLine ? 'border-b-4 border-double border-slate-700' : ''}`}>
            <span className="text-sm uppercase tracking-wide">{label}</span>
            <span className={`font-mono tabular-nums text-sm ${nivel === 3 ? 'text-white' : negativo ? 'text-red-600' : ''}`}>
                {negativo ? `(${fmt(Math.abs(valor))})` : fmt(Math.abs(valor))}
            </span>
        </div>
    );
};

const TituloSeccion = ({ children, color = 'text-[#1E3A5F]' }) => (
    <div className={`px-4 py-2 mt-4 mb-1 font-bold text-xs uppercase tracking-widest ${color} border-b-2 border-current`}>
        {children}
    </div>
);

/** Fila separadora de bloque para Balance de Saldos */
const FilaBloqueBS = ({ label }) => (
    <tr>
        <td colSpan={7} className="bg-slate-100 px-4 py-2 font-bold text-[#1E3A5F] text-xs uppercase tracking-widest border-t-2 border-[#1E3A5F]/20">
            {label}
        </td>
    </tr>
);

/** Spinner de carga */
const Spinner = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-[#1E3A5F] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-gray-400 text-sm">Cargando reporte...</p>
    </div>
);

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
function Reportes() {
    const navigate = useNavigate();
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [tipoFiltro, setTipoFiltro] = useState('MES'); // MES, ANIO, RANGO, HISTORICO
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    const [reporteActivo, setReporteActivo] = useState(null);

    // datos y datosCrudos inicializados en null (backend retorna objetos estructurados)
    const [datos, setDatos] = useState(null);
    const [datosCrudos, setDatosCrudos] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [filtros, setFiltros] = useState({ cuenta: '' });

    // Estado de período NIIF
    const [periodo, setPeriodo] = useState({
        anio: new Date().getFullYear(),
        mes:  new Date().getMonth() + 1,
    });

    const mostrarMensaje = useCallback((texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    }, []);

    // ── Carga de reportes con parámetros de período ────────────
        // ── NUEVO: Sincronizador en tiempo real para refrescar datos al mover las flechas del Año/Mes ──
        // ── NUEVO: Sincronizador en tiempo real multifiltro ──
    // Se dispara de inmediato si el usuario cambia el Año, Mes, la Modalidad o los calendarios
    useEffect(() => {
        if (reporteActivo) {
            cargarReporte(reporteActivo);
        }
    }, [periodo.anio, periodo.mes, tipoFiltro, fechaDesde, fechaHasta, reporteActivo]);

    // ── Carga de reportes dinámica y adaptada al panel de búsqueda avanzado ──
        // ── Carga de reportes dinámica y adaptada al panel de búsqueda avanzado ──
    const cargarReporte = useCallback(async (tipo, anioSel = periodo.anio, mesSel = periodo.mes) => {
        setCargando(true);
        setReporteActivo(tipo);
        setDatos(null);
        setDatosCrudos(null);
        setFiltros({ cuenta: '' });

        // 1. CONSTRUCCIÓN DEL QUERY STRING CON TODOS LOS PARÁMETROS NUEVOS
        const params = new URLSearchParams();
        params.append('anio', parseInt(anioSel));
        params.append('mes', parseInt(mesSel));
        params.append('tipo', tipoFiltro); // Envía MES, ANIO, RANGO o HISTORICO
        
        // Si el usuario seleccionó rango, inyectamos los calendarios de forma segura
        if (tipoFiltro === 'RANGO') {
            params.append('fechaDesde', fechaDesde);
            params.append('fechaHasta', fechaHasta);
        }

        // Esto genera automáticamente algo como: ?anio=2026&mes=5&tipo=RANGO&fechaDesde=2026-01-01...
        const queryParamsString = `?${params.toString()}`;

        try {
            let res;
            // 2. Se envía el string completo y masticado a tus métodos actuales de Axios
            if (tipo === 'libro-diario')          res = await reportesService.getLibroDiario(queryParamsString);
            else if (tipo === 'balance-general')   res = await reportesService.getBalanceGeneral(queryParamsString);
            else if (tipo === 'estado-resultados') res = await reportesService.getEstadoResultados(queryParamsString);
            else if (tipo === 'balance-saldos')    res = await reportesService.getBalanceSaldos(queryParamsString);

            if (res && res.data) {
                setDatosCrudos(res.data);
                setDatos(res.data);
            }
        } catch (err) {
            console.error('[Error de Axios]', err);
            mostrarMensaje('Error al obtener datos financieros con los filtros seleccionados.', 'error');
        } finally {
            setCargando(false);
        }
    }, [mostrarMensaje, periodo.anio, periodo.mes, tipoFiltro, fechaDesde, fechaHasta]);

    // ── Filtros en memoria (Buscador superior de cuentas) ────────────────────────────────
    const aplicarFiltros = useCallback((fuente, f) => {
        if (!fuente) return null;
        const busqueda = f.cuenta.trim().toLowerCase();
        if (!busqueda) return fuente;

        if (reporteActivo === 'libro-diario') {
            const arr = Array.isArray(fuente) ? [...fuente] : [];
            return arr.filter(p =>
                p.movimientos?.some(m =>
                    String(m.CUENTA_ID).toLowerCase().includes(busqueda) ||
                    (m.NOMBRE_CUENTA && m.NOMBRE_CUENTA.toLowerCase().includes(busqueda))
                )
            );
        }

        if (reporteActivo === 'balance-saldos') {
            const cuentas = fuente?.cuentas || [];
            return {
                ...fuente,
                cuentas: cuentas.filter(c =>
                    String(c.CUENTA_ID).toLowerCase().includes(busqueda) ||
                    (c.NOMBRE && c.NOMBRE.toLowerCase().includes(busqueda))
                ),
            };
        }

        // Filtro relacional en caliente para los sub-arreglos de los estados financieros
        if (reporteActivo === 'balance-general') {
            return {
                ...fuente,
                activos: (fuente.activos || []).filter(c => String(c.CUENTA_ID).includes(busqueda) || c.NOMBRE.toLowerCase().includes(busqueda)),
                pasivos: (fuente.pasivos || []).filter(c => String(c.CUENTA_ID).includes(busqueda) || c.NOMBRE.toLowerCase().includes(busqueda)),
                patrimonio: (fuente.patrimonio || []).filter(c => String(c.CUENTA_ID).includes(busqueda) || c.NOMBRE.toLowerCase().includes(busqueda))
            };
        }

        if (reporteActivo === 'estado-resultados') {
            return {
                ...fuente,
                ingresos: (fuente.ingresos || []).filter(c => String(c.CUENTA_ID).includes(busqueda) || c.NOMBRE.toLowerCase().includes(busqueda)),
                gastos: (fuente.gastos || []).filter(c => String(c.CUENTA_ID).includes(busqueda) || c.NOMBRE.toLowerCase().includes(busqueda)),
                costos: (fuente.costos || []).filter(c => String(c.CUENTA_ID).includes(busqueda) || c.NOMBRE.toLowerCase().includes(busqueda))
            };
        }

        return fuente;
    }, [reporteActivo]);


    const handleFiltro = (e) => {
        const nuevosFiltros = { ...filtros, [e.target.name]: e.target.value };
        setFiltros(nuevosFiltros);
        setDatos(aplicarFiltros(datosCrudos, nuevosFiltros));
    };

    const limpiarFiltros = () => {
        setFiltros({ cuenta: '' });
        setDatos(datosCrudos);
    };

    // ── Helper: orden de movimientos ───────────
    const ordenarMovimientos = (movimientos = []) =>
        [...movimientos].sort((a, b) => {
            const aEsDebe = (parseFloat(a.DEBE) || 0) > 0;
            const bEsDebe = (parseFloat(b.DEBE) || 0) > 0;
            if (aEsDebe && !bEsDebe) return -1;
            if (!aEsDebe && bEsDebe) return 1;
            return 0;
        });

    // ── datosArray (libro diario) ──────────────
    const datosArray = useMemo(() => {
        if (!datos) return [];
        if (reporteActivo === 'libro-diario') return Array.isArray(datos) ? datos : [];
        return [];
    }, [datos, reporteActivo]);

    // ── Estado de Resultados — extrae del servidor ─────────────
    // El backend ya calculó todos los totales; sólo mapeamos.
    const calcER = useMemo(() => {
        if (reporteActivo !== 'estado-resultados' || !datos) return {};
        return {
            ingresos:      datos.ingresos      || [],
            gastos:        datos.gastos        || [],
            costos:        datos.costos        || [],
            totalIngresos: datos.totalIngresos ?? 0,
            totalCostos:   datos.totalCostos   ?? 0,
            utilidadBruta: datos.utilidadBruta ?? 0,
            totalGastos:   datos.totalGastos   ?? 0,
            utilidadNeta:  datos.utilidadNeta  ?? 0,
        };
    }, [datos, reporteActivo]);

    // ── Balance General — extrae del servidor ──────────────────
    const calcBG = useMemo(() => {
        if (reporteActivo !== 'balance-general' || !datos) return {};

        const activos   = datos.activos   || [];
        const pasivos   = datos.pasivos   || [];
        const patrimonio = datos.patrimonio || [];

        return {
            activoCorriente:   activos.filter(d => d.SUB_RUBRO?.toUpperCase() === 'CORRIENTE'),
            activoNoCorriente: activos.filter(d => d.SUB_RUBRO?.toUpperCase() !== 'CORRIENTE'),
            pasivoCorriente:   pasivos.filter(d => d.SUB_RUBRO?.toUpperCase() === 'CORRIENTE'),
            pasivoNoCorriente: pasivos.filter(d => d.SUB_RUBRO?.toUpperCase() !== 'CORRIENTE'),
            patrimonio,
            // Totales proveídos por el servidor
            totalActivo:           datos.totalActivo           ?? 0,
            totalPasivo:           datos.totalPasivo           ?? 0,
            totalPatrimonio:       datos.totalPatrimonio       ?? 0,
            totalPasivoPatrimonio: datos.totalPasivoPatrimonio ?? 0,
            cuadrado:              datos.cuadrado              ?? false,
        };
    }, [datos, reporteActivo]);

    // ── Balance de Saldos — clasificado en 4 bloques ───────────
    const calcBS = useMemo(() => {
        if (reporteActivo !== 'balance-saldos' || !datos) return {};

        const cuentas = datos.cuentas || (Array.isArray(datos) ? datos : []);

        // 4 bloques según rúbrica del docente
        const activoFijo       = cuentas.filter(c => c.RUBRO === 'ACTIVO'  && c.SUB_RUBRO?.toUpperCase() === 'NO CORRIENTE');
        const activoCorriente  = cuentas.filter(c => c.RUBRO === 'ACTIVO'  && c.SUB_RUBRO?.toUpperCase() === 'CORRIENTE');
        const pasivo           = cuentas.filter(c => c.RUBRO === 'PASIVO'  && c.SUB_RUBRO?.toUpperCase() !== 'PATRIMONIO');
        const capital          = cuentas.filter(c => c.RUBRO === 'PASIVO'  && c.SUB_RUBRO?.toUpperCase() === 'PATRIMONIO');

        // Totales globales (preferir los del servidor si existen)
        const totalDebe  = datos.totales?.totalDebe  ?? cuentas.reduce((s, c) => s + (parseFloat(c.SUMA_DEBE)  || 0), 0);
        const totalHaber = datos.totales?.totalHaber ?? cuentas.reduce((s, c) => s + (parseFloat(c.SUMA_HABER) || 0), 0);
        const cuadrado   = datos.cuadrado            ?? Math.abs(totalDebe - totalHaber) < 0.01;

        const RUBROS_ACREEDORES = ['GANANCIA', 'PASIVO', 'PATRIMONIO'];

        const totalSaldoDeudor   = cuentas.reduce((s, c) => {
            if (RUBROS_ACREEDORES.includes(c.RUBRO)) return s;
            return s + Math.abs(parseFloat(c.SALDO_FINAL) || 0);
        }, 0);
        const totalSaldoAcreedor = cuentas.reduce((s, c) => {
            if (!RUBROS_ACREEDORES.includes(c.RUBRO)) return s;
            return s + Math.abs(parseFloat(c.SALDO_FINAL) || 0);
        }, 0);

        return {
            activoFijo,
            activoCorriente,
            pasivo,
            capital,
            totalDebe,
            totalHaber,
            totalSaldoDeudor,
            totalSaldoAcreedor,
            cuadrado,
            RUBROS_ACREEDORES,
        };
    }, [datos, reporteActivo]);

    // ── Libro Diario — totales globales ───────────
    const calcLD = useMemo(() => {
        if (reporteActivo !== 'libro-diario') return {};
        return {
            totalDebe:  datosArray.reduce((s, p) => s + (p.totalDebe  || 0), 0),
            totalHaber: datosArray.reduce((s, p) => s + (p.totalHaber || 0), 0),
        };
    }, [datosArray, reporteActivo]);

    // ── Conteo de registros visibles ───────────
    const totalRegistros = useMemo(() => {
        if (!datos) return 0;
        if (reporteActivo === 'libro-diario')    return datosArray.length;
        if (reporteActivo === 'balance-saldos')  return (datos.cuentas || []).length;
        if (reporteActivo === 'balance-general') return (datos.activos?.length || 0) + (datos.pasivos?.length || 0) + (datos.patrimonio?.length || 0);
        if (reporteActivo === 'estado-resultados') return (datos.ingresos?.length || 0) + (datos.gastos?.length || 0) + (datos.costos?.length || 0);
        return 0;
    }, [datos, datosArray, reporteActivo]);

    // ─────────────────────────────────────────────
    // EXPORTAR PDF
    // ─────────────────────────────────────────────
    const exportarPDF = () => {
        if (!datos) return;
        const doc = new jsPDF();
        const titulos = {
            'libro-diario':      'Libro Diario',
            'balance-general':   'Balance General',
            'estado-resultados': 'Estado de Resultados',
            'balance-saldos':    'Balance de Saldos',
        };
        const periodoLabel = obtenerLeyendaPeriodo();

        const encabezado = (doc, subtitulo, titulo, descripcion) => {
            const azul = [30, 58, 95];
            doc.setFillColor(...azul);
            doc.rect(0, 0, 210, 30, 'F');
            doc.setFontSize(9);
            doc.setTextColor(147, 197, 253);
            doc.text(subtitulo, 105, 10, { align: 'center' });
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text(titulo, 105, 19, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(147, 197, 253);
            doc.text(`${descripcion}  |  Período: ${periodoLabel}  |  Generado: ${new Date().toLocaleDateString('es-GT')}`, 105, 26, { align: 'center' });
        };

        if (reporteActivo === 'libro-diario') {
            const azul = [30, 58, 95];
            encabezado(doc, 'REGISTRO CONTABLE', 'LIBRO DIARIO', 'Registro cronológico de pólizas contables');
            let startY = 36;

            datosArray.forEach((partida) => {
                const movimientosOrdenados = ordenarMovimientos(partida.movimientos);
                autoTable(doc, {
                    startY,
                    head: [[{ content: `Partida #${partida.NUM_POLIZA || partida.POLIZA_ID}   |   Fecha: ${fmtFecha(partida.FECHA)}   |   ${partida.TIPO_POLIZA}${partida.SINOPSIS ? '   —   ' + partida.SINOPSIS : ''}`, colSpan: 4 }]],
                    body: [
                        ...movimientosOrdenados.map(m => [
                            String(m.CUENTA_ID),
                            m.NOMBRE_CUENTA,
                            (parseFloat(m.DEBE) || 0) > 0 ? fmt(m.DEBE) : '',
                            (parseFloat(m.HABER) || 0) > 0 ? fmt(m.HABER) : '',
                        ]),
                        [
                            { content: '', styles: { fontStyle: 'bold' } },
                            { content: 'TOTALES', styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: fmt(partida.totalDebe),  styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: fmt(partida.totalHaber), styles: { fontStyle: 'bold', halign: 'right' } },
                        ],
                    ],
                    headStyles: { fillColor: azul, fontSize: 8, textColor: 255, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 28, overflow: 'linebreak' },
                        1: { cellWidth: 'auto' },
                        2: { halign: 'right', cellWidth: 32 },
                        3: { halign: 'right', cellWidth: 32 },
                    },
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                    didDrawPage: (data) => {
                        if (data.pageNumber > 1) encabezado(doc, 'REGISTRO CONTABLE', 'LIBRO DIARIO', 'Registro cronológico de pólizas contables');
                    },
                });
                startY = doc.lastAutoTable.finalY + 6;
                if (startY > 260) { doc.addPage(); startY = 36; }
            });

            autoTable(doc, {
                startY,
                body: [[
                    { content: 'TOTAL GENERAL DEL LIBRO', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
                    { content: fmt(calcLD.totalDebe),  styles: { fontStyle: 'bold', halign: 'right' } },
                    { content: fmt(calcLD.totalHaber), styles: { fontStyle: 'bold', halign: 'right' } },
                ]],
                columnStyles: { 2: { halign: 'right', cellWidth: 32 }, 3: { halign: 'right', cellWidth: 32 } },
                styles: { fontSize: 9, fillColor: [30, 58, 95], textColor: 255 },
            });

                } else if (reporteActivo === 'balance-saldos') {
            const azul = [30, 58, 95];
            const { activoFijo, activoCorriente, pasivo, capital, RUBROS_ACREEDORES } = calcBS;
            encabezado(doc, 'VERIFICACIÓN CONTABLE', 'BALANCE DE SALDOS', 'Comprobación matemática de todas las cuentas');

            // NUEVA LÓGICA DE CONSTRUCCIÓN FILA POR FILA SIN ARREGLOS CORRUPTOS
            const filasTablaPDF = [];

            const procesarBloquePDF = (label, listaCuentas) => {
                if (!listaCuentas || listaCuentas.length === 0) return;
                
                // Inyectamos la fila del separador gris del bloque
                filasTablaPDF.push([
                    { content: label, colSpan: 7, styles: { fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [30, 58, 95], fontSize: 8 } }
                ]);

                // Inyectamos cada cuenta del bloque de forma independiente
                listaCuentas.forEach(c => {
                    const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
                    const saldoAbs   = Math.abs(parseFloat(c.SALDO_FINAL) || 0);
                    
                    filasTablaPDF.push([
                        String(c.CUENTA_ID),
                        c.NOMBRE,
                        c.RUBRO,
                        fmt(c.SUMA_DEBE),
                        fmt(c.SUMA_HABER),
                        !esAcreedor ? fmt(saldoAbs) : '',
                        esAcreedor  ? fmt(saldoAbs) : ''
                    ]);
                });
            };

            // Procesamos los 4 bloques en el orden correcto de tu interfaz
            procesarBloquePDF('Activo Fijo (No Corriente)', activoFijo);
            procesarBloquePDF('Activo Corriente', activoCorriente);
            procesarBloquePDF('Pasivo (Obligaciones)', pasivo);
            procesarBloquePDF('Capital / Patrimonio Neto', capital);

            // Añadimos la fila final de los Totales Generales abajo
            filasTablaPDF.push([
                { content: 'TOTALES GENERALES', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
                { content: fmt(calcBS.totalDebe),          styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
                { content: fmt(calcBS.totalHaber),         styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
                { content: fmt(calcBS.totalSaldoDeudor),   styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
                { content: fmt(calcBS.totalSaldoAcreedor), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } }
            ]);

            // Renderizamos la tabla nativa con autoTable pasándole la matriz limpia
            autoTable(doc, {
                startY: 35,
                head: [['Cuenta', 'Nombre', 'Rubro', 'Suma Debe', 'Suma Haber', 'Saldo Deudor', 'Saldo Acreedor']],
                body: filasTablaPDF,
                headStyles: { fillColor: azul, fontSize: 8, textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 22, overflow: 'linebreak', fontStyle: 'bold' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 22, halign: 'center' },
                    3: { halign: 'right', cellWidth: 26 },
                    4: { halign: 'right', cellWidth: 26 },
                    5: { halign: 'right', cellWidth: 26 },
                    6: { halign: 'right', cellWidth: 26 },
                },
                styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            // Banner final de cuadre en verde/rojo abajo de la tabla
            const cuadrado = calcBS.cuadrado;
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 4,
                body: [[{
                    content: cuadrado
                        ? `✓  SISTEMA CUADRADO  |  Debe: ${fmt(calcBS.totalDebe)}  =  Haber: ${fmt(calcBS.totalHaber)}`
                        : `✗  DIFERENCIA DETECTADA  |  Debe: ${fmt(calcBS.totalDebe)}  ≠  Haber: ${fmt(calcBS.totalHaber)}`,
                    colSpan: 7,
                    styles: { fontStyle: 'bold', textColor: [255, 255, 255], halign: 'left', fontSize: 9 },
                }]],
                styles: { fillColor: cuadrado ? [21, 128, 61] : [185, 28, 28], cellPadding: 4 },
                theme: 'plain',
            });

        } else if (reporteActivo === 'estado-resultados') {
            const azul = [30, 58, 95]; const verde = [21, 128, 61]; const rojo = [185, 28, 28]; const naranja = [194, 65, 12]; const gris1 = [241, 245, 249];
            encabezado(doc, 'ESTADO FINANCIERO', 'ESTADO DE RESULTADOS', 'Del período contable registrado');

            const bloqueER = (titulo, cuentas, totalLabel, totalValor, colorTitulo, esCosto, startY) => {
                autoTable(doc, { startY, body: [[{ content: titulo, colSpan: 3 }]], styles: { fontSize: 8, fontStyle: 'bold', textColor: colorTitulo, fillColor: [255,255,255], cellPadding: { top: 6, bottom: 2, left: 14, right: 4 } }, theme: 'plain', tableLineColor: colorTitulo, tableLineWidth: 0.5 });
                let y = doc.lastAutoTable.finalY;
                autoTable(doc, {
                    startY: y,
                    body: cuentas.map(d => [
                        { content: String(d.CUENTA_ID), styles: { textColor: [148,163,184], halign: 'left' } },
                        { content: d.NOMBRE, styles: { textColor: [51,65,85] } },
                        { content: esCosto ? `(${fmt(Math.abs(d.SALDO))})` : fmt(Math.abs(d.SALDO)), styles: { halign: 'right', textColor: esCosto ? rojo : [30,41,59] } },
                    ]),
                    columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 38 } },
                    styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 20, right: 4 }, overflow: 'linebreak' },
                    theme: 'plain', alternateRowStyles: { fillColor: [248,250,252] },
                });
                y = doc.lastAutoTable.finalY;
                autoTable(doc, { startY: y, body: [[{ content: totalLabel, colSpan: 2, styles: { fontStyle: 'bold', textColor: [30,41,59] } }, { content: esCosto ? `(${fmt(totalValor)})` : fmt(totalValor), styles: { fontStyle: 'bold', halign: 'right', textColor: esCosto ? rojo : [30,41,59] } }]], columnStyles: { 2: { cellWidth: 38 } }, styles: { fontSize: 8, fillColor: gris1, cellPadding: { top: 3, bottom: 3, left: 14, right: 4 } }, theme: 'plain' });
                return doc.lastAutoTable.finalY;
            };

            let y = 36;
            if (calcER.ingresos?.length > 0) { y = bloqueER('INGRESOS',         calcER.ingresos, 'Total Ingresos', calcER.totalIngresos, verde,   false, y); y += 3; }
            if (calcER.costos?.length   > 0) { y = bloqueER('COSTO DE VENTAS',  calcER.costos,   'Total Costos',  calcER.totalCostos,   naranja, true,  y); y += 3; }

            autoTable(doc, { startY: y, body: [[{ content: 'UTILIDAD BRUTA', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255] } }, { content: calcER.utilidadBruta < 0 ? `(${fmt(Math.abs(calcER.utilidadBruta))})` : fmt(calcER.utilidadBruta), styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255] } }]], columnStyles: { 2: { cellWidth: 38 } }, styles: { fontSize: 9, fillColor: calcER.utilidadBruta < 0 ? rojo : azul, cellPadding: { top: 4, bottom: 4, left: 14, right: 4 } }, theme: 'plain' });
            y = doc.lastAutoTable.finalY + 5;

            if (calcER.gastos?.length   > 0) { y = bloqueER('GASTOS OPERATIVOS', calcER.gastos,  'Total Gastos',  calcER.totalGastos,   rojo,    true,  y); y += 3; }

            const esUtilidad = calcER.utilidadNeta >= 0;
            autoTable(doc, { startY: y, body: [[{ content: esUtilidad ? '✓  UTILIDAD NETA DEL PERÍODO' : '✗  PÉRDIDA NETA DEL PERÍODO', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255], fontSize: 10 } }, { content: esUtilidad ? fmt(calcER.utilidadNeta) : `(${fmt(Math.abs(calcER.utilidadNeta))})`, styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255], fontSize: 10 } }]], columnStyles: { 2: { cellWidth: 38 } }, styles: { fillColor: esUtilidad ? azul : rojo, cellPadding: { top: 5, bottom: 5, left: 14, right: 4 } }, theme: 'plain' });

        } else if (reporteActivo === 'balance-general') {
            const azul = [30, 58, 95]; const rojo = [185, 28, 28]; const verde = [21, 128, 61]; const gris1 = [241, 245, 249];
            encabezado(doc, 'ESTADO DE SITUACIÓN FINANCIERA', 'BALANCE GENERAL', 'Clasificado por disponibilidad');

            const sumAbs = (arr) => arr.reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0);
            const sum    = (arr) => arr.reduce((s, d) => s + (parseFloat(d.SALDO) || 0), 0);

            const subBloque = (titulo, cuentas, labelTotal, valorTotal, colorTitulo, startY) => {
                autoTable(doc, { startY, body: [[{ content: titulo, colSpan: 3 }]], styles: { fontSize: 7, fontStyle: 'bold', textColor: colorTitulo, fillColor: [255,255,255], cellPadding: { top: 5, bottom: 1, left: 10, right: 4 } }, theme: 'plain' });
                let y = doc.lastAutoTable.finalY;
                autoTable(doc, { startY: y, body: cuentas.map(d => [{ content: String(d.CUENTA_ID), styles: { textColor: [148,163,184], fontSize: 7 } }, { content: d.NOMBRE, styles: { textColor: [51,65,85], fontSize: 7 } }, { content: fmt(Math.abs(d.SALDO)), styles: { halign: 'right', textColor: [30,41,59], fontSize: 7 } }]), columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 28 } }, styles: { fontSize: 7, cellPadding: { top: 1.5, bottom: 1.5, left: 16, right: 4 }, overflow: 'linebreak' }, theme: 'plain', alternateRowStyles: { fillColor: [248,250,252] } });
                y = doc.lastAutoTable.finalY;
                autoTable(doc, { startY: y, body: [[{ content: labelTotal, colSpan: 2, styles: { fontStyle: 'bold', textColor: [30,41,59], fontSize: 7 } }, { content: fmt(valorTotal), styles: { fontStyle: 'bold', halign: 'right', fontSize: 7 } }]], columnStyles: { 2: { cellWidth: 28 } }, styles: { fillColor: gris1, cellPadding: { top: 2, bottom: 2, left: 10, right: 4 } }, theme: 'plain' });
                return doc.lastAutoTable.finalY;
            };

            autoTable(doc, { startY: 34, body: [[{ content: 'ACTIVOS', colSpan: 3 }]], styles: { fontSize: 9, fontStyle: 'bold', textColor: [255,255,255], fillColor: azul, cellPadding: { top: 3, bottom: 3, left: 10, right: 4 } }, theme: 'plain' });
            let y = doc.lastAutoTable.finalY;
            const aC  = calcBG.activoCorriente   || [];
            const aNC = calcBG.activoNoCorriente  || [];
            y = subBloque('Activo Corriente',    aC,  'Total Activo Corriente',    sum(aC),  [37,99,235],  y);
            y = subBloque('Activo No Corriente', aNC, 'Total Activo No Corriente', sum(aNC), [30,58,95],   y);
            autoTable(doc, { startY: y, body: [[{ content: 'TOTAL ACTIVOS', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255], fontSize: 9 } }, { content: fmt(calcBG.totalActivo), styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255], fontSize: 9 } }]], columnStyles: { 2: { cellWidth: 28 } }, styles: { fillColor: azul, cellPadding: { top: 4, bottom: 4, left: 10, right: 4 } }, theme: 'plain' });
            y = doc.lastAutoTable.finalY + 6;

            autoTable(doc, { startY: y, body: [[{ content: 'PASIVOS Y PATRIMONIO', colSpan: 3 }]], styles: { fontSize: 9, fontStyle: 'bold', textColor: [255,255,255], fillColor: rojo, cellPadding: { top: 3, bottom: 3, left: 10, right: 4 } }, theme: 'plain' });
            const pC  = calcBG.pasivoCorriente   || [];
            const pNC = calcBG.pasivoNoCorriente  || [];
            const pat = calcBG.patrimonio         || [];
            y = doc.lastAutoTable.finalY;
            y = subBloque('Pasivo Corriente',    pC,  'Total Pasivo Corriente',    sumAbs(pC),  [185,28,28],  y);
            y = subBloque('Pasivo No Corriente', pNC, 'Total Pasivo No Corriente', sumAbs(pNC), [153,27,27],  y);
            autoTable(doc, { startY: y, body: [[{ content: 'TOTAL PASIVOS', colSpan: 2, styles: { fontStyle: 'bold', textColor: [30,41,59], fontSize: 8 } }, { content: fmt(calcBG.totalPasivo), styles: { fontStyle: 'bold', halign: 'right', fontSize: 8 } }]], columnStyles: { 2: { cellWidth: 28 } }, styles: { fillColor: [254,226,226], cellPadding: { top: 3, bottom: 3, left: 10, right: 4 } }, theme: 'plain' });
            y = doc.lastAutoTable.finalY + 2;
            y = subBloque('Patrimonio', pat, 'Total Patrimonio', sumAbs(pat), [4,120,87], y);
            autoTable(doc, { startY: y, body: [[{ content: 'TOTAL PASIVO + PATRIMONIO', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255], fontSize: 9 } }, { content: fmt(calcBG.totalPasivoPatrimonio), styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255], fontSize: 9 } }]], columnStyles: { 2: { cellWidth: 28 } }, styles: { fillColor: azul, cellPadding: { top: 4, bottom: 4, left: 10, right: 4 } }, theme: 'plain' });
            y = doc.lastAutoTable.finalY + 6;

            const cuadrado = calcBG.cuadrado;
            autoTable(doc, { startY: y, tableWidth: 182, margin: { left: 14 }, body: [[{ content: cuadrado ? `✓  BALANCE CUADRADO  |  ${fmt(calcBG.totalActivo)} = ${fmt(calcBG.totalPasivoPatrimonio)}` : `✗  DESCUADRADO  |  Activos: ${fmt(calcBG.totalActivo)}  Pasivo + Pat: ${fmt(calcBG.totalPasivoPatrimonio)}`, colSpan: 3, styles: { fontStyle: 'bold', textColor: [255,255,255], halign: 'left', fontSize: 8 } }]], styles: { fillColor: cuadrado ? verde : rojo, cellPadding: { top: 4, bottom: 4 } }, theme: 'plain' });
        }

        doc.save(`${titulos[reporteActivo]}.pdf`);
    };

    // ─────────────────────────────────────────────
    // EXPORTAR EXCEL
    // ─────────────────────────────────────────────
    const exportarExcel = () => {
        if (!datos) return;
        const titulos = {
            'libro-diario':      'Libro Diario',
            'balance-general':   'Balance General',
            'estado-resultados': 'Estado de Resultados',
            'balance-saldos':    'Balance de Saldos',
        };
        let datosExcel = [];

        if (reporteActivo === 'libro-diario') {
            datosArray.forEach(p => {
                ordenarMovimientos(p.movimientos).forEach(m => {
                    datosExcel.push({ Partida: p.NUM_POLIZA || p.POLIZA_ID, Fecha: fmtFecha(p.FECHA), Tipo: p.TIPO_POLIZA, Sinopsis: p.SINOPSIS, Cuenta: m.CUENTA_ID, Nombre_Cuenta: m.NOMBRE_CUENTA, Debe: parseFloat(m.DEBE) || 0, Haber: parseFloat(m.HABER) || 0 });
                });
            });
        } else if (reporteActivo === 'balance-saldos') {
            const { activoFijo = [], activoCorriente = [], pasivo = [], capital = [], RUBROS_ACREEDORES = [] } = calcBS;
            const todosBloque = [
                ...activoFijo.map(c => ({ ...c, _bloque: 'Activo Fijo (No Corriente)' })),
                ...activoCorriente.map(c => ({ ...c, _bloque: 'Activo Corriente' })),
                ...pasivo.map(c => ({ ...c, _bloque: 'Pasivo (Obligaciones)' })),
                ...capital.map(c => ({ ...c, _bloque: 'Capital / Patrimonio Neto' })),
            ];
            datosExcel = todosBloque.map(c => {
                const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
                const saldoAbs   = Math.abs(parseFloat(c.SALDO_FINAL) || 0);
                return { Bloque: c._bloque, Cuenta: c.CUENTA_ID, Nombre: c.NOMBRE, Rubro: c.RUBRO, Suma_Debe: parseFloat(c.SUMA_DEBE), Suma_Haber: parseFloat(c.SUMA_HABER), Saldo_Deudor: !esAcreedor ? saldoAbs : 0, Saldo_Acreedor: esAcreedor ? saldoAbs : 0 };
            });
        } else if (reporteActivo === 'estado-resultados') {
            const { ingresos = [], costos = [], gastos = [] } = calcER;
            datosExcel = [
                ...ingresos.map(d => ({ Seccion: 'Ingresos',         Cuenta: d.CUENTA_ID, Nombre: d.NOMBRE, Rubro: d.RUBRO, Saldo: Math.abs(parseFloat(d.SALDO)) })),
                ...costos.map(d  => ({ Seccion: 'Costo de Ventas',   Cuenta: d.CUENTA_ID, Nombre: d.NOMBRE, Rubro: d.RUBRO, Saldo: Math.abs(parseFloat(d.SALDO)) })),
                ...gastos.map(d  => ({ Seccion: 'Gastos Operativos', Cuenta: d.CUENTA_ID, Nombre: d.NOMBRE, Rubro: d.RUBRO, Saldo: Math.abs(parseFloat(d.SALDO)) })),
            ];
        } else {
            const activos = datos.activos || []; const pasivos = datos.pasivos || []; const pat = datos.patrimonio || [];
            datosExcel = [
                ...activos.map(d => ({ Seccion: 'Activo', Cuenta: d.CUENTA_ID, Nombre: d.NOMBRE, Sub_Rubro: d.SUB_RUBRO, Saldo: Math.abs(parseFloat(d.SALDO)) })),
                ...pasivos.map(d => ({ Seccion: 'Pasivo', Cuenta: d.CUENTA_ID, Nombre: d.NOMBRE, Sub_Rubro: d.SUB_RUBRO, Saldo: Math.abs(parseFloat(d.SALDO)) })),
                ...pat.map(d    => ({ Seccion: 'Patrimonio', Cuenta: d.CUENTA_ID, Nombre: d.NOMBRE, Sub_Rubro: d.SUB_RUBRO, Saldo: Math.abs(parseFloat(d.SALDO)) })),
            ];
        }

        const ws = XLSX.utils.json_to_sheet(datosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, titulos[reporteActivo].substring(0, 30)); // Oracle/Excel limitan pestañas a 31 caracteres
        
        // El nombre del archivo ahora incluirá dinámicamente el filtro (MES, AÑO o RANGO)
        XLSX.writeFile(wb, `${titulos[reporteActivo]} - ${obtenerLeyendaPeriodo()}.xlsx`);
    };

    // ── Helpers UI ─────────────────────────────
    const inputClass  = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass  = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";
    const hayDatos    = datos !== null && !cargando;
    const obtenerLeyendaPeriodo = () => {
        if (tipoFiltro === 'MES') return `${MESES.find(m => m.value === periodo.mes)?.label} ${periodo.anio}`;
        if (tipoFiltro === 'ANIO') return `Año Fiscal Completo ${periodo.anio}`;
        if (tipoFiltro === 'RANGO') return `Rango: ${fechaDesde || '...'} al ${fechaHasta || '...'}`;
        return 'Historial Contable Completo';
    };


    const BtnReporte = ({ tipo, label, icon }) => (
        <button
            onClick={() => cargarReporte(tipo)}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                reporteActivo === tipo
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-lg shadow-[#1E3A5F]/20'
                    : 'bg-white text-[#1E3A5F] border-[#1E3A5F]/40 hover:border-[#1E3A5F] hover:bg-[#f0f4fa]'
            }`}
        >
            <span className="text-lg">{icon}</span>
            {label}
        </button>
    );

    // ── Renderizador de filas BS por bloque ────
    const renderFilasBS = (cuentas = []) => {
        const { RUBROS_ACREEDORES = [] } = calcBS;
        return cuentas.map((c, index) => {
            const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
            const saldoAbs   = Math.abs(parseFloat(c.SALDO_FINAL) || 0);
            return (
                <tr key={c.CUENTA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{c.CUENTA_ID}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{c.NOMBRE}</td>
                    <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{c.RUBRO}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(c.SUMA_DEBE)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(c.SUMA_HABER)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                        {!esAcreedor ? fmt(saldoAbs) : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                        {esAcreedor ? fmt(saldoAbs) : <span className="text-gray-200">—</span>}
                    </td>
                </tr>
            );
        });
    };

    // ────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />

            {/* Header */}
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📈</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Reportes Financieros</h1>
                            <p className="text-blue-200 text-sm">Estados financieros bajo estándares NIIF</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                        ← Regresar
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">

                {/* ── PERÍODO CONTABLE Y FILTROS AVANZADOS ─────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-[#1E3A5F] font-bold text-lg mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                <span>🗓️</span> Período Contable y Filtros de Búsqueda
            </h2>
    
            <div className="flex flex-wrap gap-4 items-end">
                {/* 1. Selector de Modalidad (Tipo de Filtro) */}
                <div className="w-56">
                <label className={labelClass}>Tipo de Filtro</label>
            <select
                value={tipoFiltro}
                onChange={e => setTipoFiltro(e.target.value)}
                className={inputClass}
            >
                <option value="MES">Por Mes (Acumulado)</option>
                <option value="ANIO">Por Año Completo</option>
                <option value="RANGO">Rango de Fechas</option>
                <option value="HISTORICO">Todo el Histórico</option>
            </select>
        </div>

        {/* 2. Inputs de Año y Mes (Se ocultan si eligen Rango o Histórico para no confundir) */}
        {tipoFiltro !== 'RANGO' && tipoFiltro !== 'HISTORICO' && (
            <>
                <div className="w-36">
                    <label className={labelClass}>Año</label>
                    <input
                        type="number"
                        min="2000"
                        max="2099"
                        value={periodo.anio}
                        onChange={e => setPeriodo(p => ({ ...p, anio: parseInt(e.target.value) || p.anio }))}
                        className={inputClass}
                    />
                </div>
                {tipoFiltro === 'MES' && (
                    <div className="w-48">
                        <label className={labelClass}>Mes</label>
                        <select
                            value={periodo.mes}
                            onChange={e => setPeriodo(p => ({ ...p, mes: parseInt(e.target.value) }))}
                            className={inputClass}
                        >
                            {MESES.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                )}
            </>
        )}

        {/* 3. Inputs Dinámicos de Fecha (Solo se muestran si eligen RANGO) */}
        {tipoFiltro === 'RANGO' && (
            <>
                <div className="w-44">
                    <label className={labelClass}>Fecha Desde</label>
                    <input
                        type="date"
                        value={fechaDesde}
                        onChange={e => setFechaDesde(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <div className="w-44">
                    <label className={labelClass}>Fecha Hasta</label>
                    <input
                        type="date"
                        value={fechaHasta}
                        onChange={e => setFechaHasta(e.target.value)}
                        className={inputClass}
                    />
                </div>
            </>
        )}

        {/* 4. Leyenda Informativa Dinámica */}
        <div className="text-xs text-gray-400 pb-2 flex-grow sm:text-right">
            {tipoFiltro === 'MES' && (
                <span>Filtrando: <span className="font-semibold text-[#1E3A5F]">{MESES.find(m => m.value === periodo.mes)?.label} {periodo.anio}</span></span>
            )}
            {tipoFiltro === 'ANIO' && (
                <span>Filtrando todo el año: <span className="font-semibold text-[#1E3A5F]">{periodo.anio}</span></span>
            )}
            {tipoFiltro === 'RANGO' && fechaDesde && fechaHasta && (
                <span>Filtrando rango: <span className="font-semibold text-[#1E3A5F]">{fechaDesde} al {fechaHasta}</span></span>
            )}
            {tipoFiltro === 'HISTORICO' && (
                <span className="font-semibold text-green-600">Mostrando historial completo</span>
            )}
        </div>
    </div>
</div>


                {/* ── SELECTOR DE REPORTE ACTUALIZADO ──────────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Selecciona un Reporte</h2>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => cargarReporte("libro-diario", periodo.anio, periodo.mes)} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all ${reporteActivo === "libro-diario" ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#1E3A5F] border-[#1E3A5F]/40'}`}>📖 Libro Diario</button>
                        <button onClick={() => cargarReporte("balance-saldos", periodo.anio, periodo.mes)} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all ${reporteActivo === "balance-saldos" ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#1E3A5F] border-[#1E3A5F]/40'}`}>🔢 Balance de Saldos</button>
                        <button onClick={() => cargarReporte("estado-resultados", periodo.anio, periodo.mes)} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all ${reporteActivo === "estado-resultados" ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#1E3A5F] border-[#1E3A5F]/40'}`}>📊 Estado de Resultados</button>
                        <button onClick={() => cargarReporte("balance-general", periodo.anio, periodo.mes)} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all ${reporteActivo === "balance-general" ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#1E3A5F] border-[#1E3A5F]/40'}`}>⚖️ Balance General</button>
                    </div>
                </div>


                {/* ── FILTROS + EXPORTAR ───────────────────────────── */}
                {reporteActivo && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1">
                                <label className={labelClass}>🔍 Buscar Cuenta</label>
                                <input name="cuenta" value={filtros.cuenta} onChange={handleFiltro} className={inputClass} placeholder="ID o nombre de cuenta..." />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={limpiarFiltros} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">
                                    Limpiar
                                </button>
                                {hayDatos && totalRegistros > 0 && (
                                    <>
                                        <button onClick={exportarPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                                            📄 PDF
                                        </button>
                                        <button onClick={exportarExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                                            📊 Excel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">{totalRegistros} registro(s) visible(s)</p>
                    </div>
                )}

                {/* ── SPINNER ──────────────────────────────────────── */}
                {cargando && <Spinner />}

                {/* ════════════════════════════════════════
                    LIBRO DIARIO
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'libro-diario' && datos !== null && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                                <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Registro Contable</p>
                                <h2 className="text-xl font-extrabold tracking-wide">LIBRO DIARIO</h2>
                                <p className="text-blue-200 text-xs mt-1">
                                    {obtenerLeyendaPeriodo()} — Registro cronológico de pólizas contables
                                </p>

                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <span className="text-sm text-gray-400">{datosArray.length} partida(s)</span>
                        </div>

                        {datosArray.map((partida) => (
                            <div key={partida.POLIZA_ID} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-[#1E3A5F]/5 px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-[#1E3A5F] text-white text-xs font-bold px-3 py-1 rounded-full">
                                            Partida #{partida.NUM_POLIZA || partida.POLIZA_ID}
                                        </span>
                                        <span className="text-sm text-gray-600 font-medium">{fmtFecha(partida.FECHA)}</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{partida.TIPO_POLIZA}</span>
                                    </div>
                                    <span className="text-xs text-gray-500 italic">{partida.SINOPSIS}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                                                <th className="px-4 py-2 text-left w-24">Cuenta</th>
                                                <th className="px-4 py-2 text-left">Nombre</th>
                                                <th className="px-4 py-2 text-right w-32">Debe</th>
                                                <th className="px-4 py-2 text-right w-32">Haber</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ordenarMovimientos(partida.movimientos).map((m) => (
                                                <tr key={m.DETALLE_ID} className="border-t border-gray-100 hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-mono text-gray-500 text-xs">{m.CUENTA_ID}</td>
                                                    <td className={`px-4 py-2 text-gray-800 ${(parseFloat(m.HABER) || 0) > 0 ? 'pl-12' : ''}`}>
                                                        {(parseFloat(m.HABER) || 0) > 0 && <span className="text-gray-300 mr-2">↳</span>}
                                                        {m.NOMBRE_CUENTA}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-gray-700">
                                                        {(parseFloat(m.DEBE) || 0) > 0 ? fmt(m.DEBE) : <span className="text-gray-200">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-gray-700">
                                                        {(parseFloat(m.HABER) || 0) > 0 ? fmt(m.HABER) : <span className="text-gray-200">—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-[#1E3A5F] text-white font-bold text-sm">
                                                <td colSpan="2" className="px-4 py-2 text-right text-xs uppercase tracking-wide">Totales partida</td>
                                                <td className="px-4 py-2 text-right font-mono">{fmt(partida.totalDebe)}</td>
                                                <td className="px-4 py-2 text-right font-mono">{fmt(partida.totalHaber)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                {Math.abs(partida.totalDebe - partida.totalHaber) > 0.01 && (
                                    <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-600 font-semibold">
                                        ⚠️ Partida descuadrada — Diferencia: {fmt(Math.abs(partida.totalDebe - partida.totalHaber))}
                                    </div>
                                )}
                            </div>
                        ))}

                        <div className="bg-[#1E3A5F] text-white rounded-xl px-6 py-4 flex items-center justify-between">
                            <span className="font-bold text-sm uppercase tracking-wide">Total General del Libro</span>
                            <div className="flex gap-8 font-mono text-sm">
                                <span>Debe: <strong>{fmt(calcLD.totalDebe)}</strong></span>
                                <span>Haber: <strong>{fmt(calcLD.totalHaber)}</strong></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    ESTADO DE RESULTADOS
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'estado-resultados' && datos !== null && (
                    <div className="block w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                        <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Estado Financiero</p>
                            <h2 className="text-xl font-extrabold tracking-wide">ESTADO DE RESULTADOS</h2>
                            <p className="text-blue-200 text-xs mt-1">
                                {obtenerLeyendaPeriodo()}
                            </p>

                        </div>

                        <div className="py-2">
                            <TituloSeccion color="text-green-700">Ingresos</TituloSeccion>
                            {(calcER.ingresos || []).map(d => (
                                <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} />
                            ))}
                            <FilaTotal label="Total Ingresos" valor={calcER.totalIngresos ?? 0} nivel={1} />

                            {(calcER.costos || []).length > 0 && (
                                <>
                                    <TituloSeccion color="text-orange-700">Costo de Ventas</TituloSeccion>
                                    {calcER.costos.map(d => (
                                        <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} negativo />
                                    ))}
                                    <FilaTotal label="Total Costos" valor={calcER.totalCostos ?? 0} nivel={1} negativo />
                                </>
                            )}

                            <FilaTotal label="UTILIDAD BRUTA" valor={calcER.utilidadBruta ?? 0} nivel={2} negativo={(calcER.utilidadBruta ?? 0) < 0} />

                            <TituloSeccion color="text-red-700">Gastos Operativos</TituloSeccion>
                            {(calcER.gastos || []).map(d => (
                                <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} negativo />
                            ))}
                            <FilaTotal label="Total Gastos" valor={calcER.totalGastos ?? 0} nivel={1} negativo />

                            <div className="mt-2">
                                <FilaTotal
                                    label={(calcER.utilidadNeta ?? 0) >= 0 ? '✅ UTILIDAD NETA DEL PERÍODO' : '❌ PÉRDIDA NETA DEL PERÍODO'}
                                    valor={calcER.utilidadNeta ?? 0}
                                    nivel={3}
                                    negativo={(calcER.utilidadNeta ?? 0) < 0}
                                    doubleLine
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    BALANCE GENERAL
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'balance-general' && datos !== null && (
                    <div className="block w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Estado de Situación Financiera</p>
                            <h2 className="text-xl font-extrabold tracking-wide">BALANCE GENERAL</h2>
                            <p className="text-blue-200 text-xs mt-1">
                                {obtenerLeyendaPeriodo()} — Clasificado por disponibilidad
                            </p>

                        </div>

                        {/* Banner cuadre */}
                        <div className={`mx-4 mt-4 rounded-xl px-5 py-3 flex items-center justify-between border ${
                            calcBG.cuadrado
                                ? 'bg-green-50 border-green-300 text-green-800'
                                : 'bg-red-50 border-red-300 text-red-800'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{calcBG.cuadrado ? '✅' : '❌'}</span>
                                <div>
                                    <p className="font-bold text-sm">{calcBG.cuadrado ? 'Balance Cuadrado' : 'Diferencia Detectada'}</p>
                                    <p className="text-xs opacity-70">Activos {calcBG.cuadrado ? '=' : '≠'} Pasivos + Patrimonio</p>
                                </div>
                            </div>
                            <div className="text-right font-mono text-sm">
                                <p>Activos: <strong>{fmt(calcBG.totalActivo)}</strong></p>
                                <p>Pasivo + Pat.: <strong>{fmt(calcBG.totalPasivoPatrimonio)}</strong></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 mt-2">
                            {/* ACTIVOS */}
                            <div className="py-2">
                                <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                                    <h3 className="font-extrabold text-[#1E3A5F] text-sm uppercase tracking-widest">ACTIVOS</h3>
                                </div>
                                <TituloSeccion color="text-blue-600">Activo Corriente</TituloSeccion>
                                {(calcBG.activoCorriente || []).map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} />
                                ))}
                                <FilaTotal label="Total Activo Corriente" valor={(calcBG.activoCorriente || []).reduce((s, d) => s + (parseFloat(d.SALDO) || 0), 0)} nivel={1} />

                                <TituloSeccion color="text-blue-800">Activo No Corriente</TituloSeccion>
                                {(calcBG.activoNoCorriente || []).map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} />
                                ))}
                                <FilaTotal label="Total Activo No Corriente" valor={(calcBG.activoNoCorriente || []).reduce((s, d) => s + (parseFloat(d.SALDO) || 0), 0)} nivel={1} />

                                <div className="mt-1">
                                    <FilaTotal label="TOTAL ACTIVOS" valor={calcBG.totalActivo ?? 0} nivel={3} />
                                </div>
                            </div>

                            {/* PASIVOS + PATRIMONIO */}
                            <div className="py-2">
                                <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                                    <h3 className="font-extrabold text-red-800 text-sm uppercase tracking-widest">PASIVOS Y PATRIMONIO</h3>
                                </div>
                                <TituloSeccion color="text-red-600">Pasivo Corriente</TituloSeccion>
                                {(calcBG.pasivoCorriente || []).map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={Math.abs(d.SALDO)} />
                                ))}
                                <FilaTotal label="Total Pasivo Corriente" valor={(calcBG.pasivoCorriente || []).reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0)} nivel={1} />

                                <TituloSeccion color="text-red-800">Pasivo No Corriente</TituloSeccion>
                                {(calcBG.pasivoNoCorriente || []).map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={Math.abs(d.SALDO)} />
                                ))}
                                <FilaTotal label="Total Pasivo No Corriente" valor={(calcBG.pasivoNoCorriente || []).reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0)} nivel={1} />
                                <FilaTotal label="TOTAL PASIVOS" valor={calcBG.totalPasivo ?? 0} nivel={2} />

                                <TituloSeccion color="text-emerald-700">Patrimonio</TituloSeccion>
                                {(calcBG.patrimonio || []).map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={Math.abs(d.SALDO)} />
                                ))}
                                <FilaTotal label="Total Patrimonio" valor={calcBG.totalPatrimonio ?? 0} nivel={1} />

                                <div className="mt-1">
                                    <FilaTotal label="TOTAL PASIVO + PATRIMONIO" valor={calcBG.totalPasivoPatrimonio ?? 0} nivel={3} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    BALANCE DE SALDOS — 4 bloques por rúbrica
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'balance-saldos' && datos !== null && (
                    <div className="block w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Verificación Contable</p>
                            <h2 className="text-xl font-extrabold tracking-wide">BALANCE DE SALDOS</h2>
                            <p className="text-blue-200 text-xs mt-1">
                                {obtenerLeyendaPeriodo()} — Comprobación matemática de todas las cuentas
                            </p>

                        </div>

                        {/* Banner cuadre */}
                        <div className={`mx-4 mt-4 rounded-xl px-5 py-3 flex items-center justify-between border ${
                            calcBS.cuadrado
                                ? 'bg-green-50 border-green-300 text-green-800'
                                : 'bg-red-50 border-red-300 text-red-800'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{calcBS.cuadrado ? '✅' : '❌'}</span>
                                <div>
                                    <p className="font-bold text-sm">{calcBS.cuadrado ? 'Sistema Cuadrado' : 'Sistema Descuadrado'}</p>
                                    <p className="text-xs opacity-70">
                                        {calcBS.cuadrado
                                            ? 'Todos los registros son consistentes'
                                            : 'Existe una diferencia entre Debe y Haber — Verificar pólizas del período'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right font-mono text-sm font-semibold">
                                <p>Σ Debe: {fmt(calcBS.totalDebe)}</p>
                                <p>Σ Haber: {fmt(calcBS.totalHaber)}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto mt-4 px-4 pb-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#1E3A5F] text-white">
                                        <th className="px-4 py-3 text-left font-semibold" rowSpan={2}>Código</th>
                                        <th className="px-4 py-3 text-left font-semibold" rowSpan={2}>Nombre de Cuenta</th>
                                        <th className="px-4 py-3 text-left font-semibold" rowSpan={2}>Rubro</th>
                                        <th className="px-4 py-2 text-center font-semibold border-b border-white/30" colSpan={2}>Movimientos</th>
                                        <th className="px-4 py-2 text-center font-semibold border-b border-white/30" colSpan={2}>Saldos</th>
                                    </tr>
                                    <tr className="bg-[#162d4a] text-white text-xs">
                                        <th className="px-4 py-2 text-right font-semibold">Suma Debe</th>
                                        <th className="px-4 py-2 text-right font-semibold">Suma Haber</th>
                                        <th className="px-4 py-2 text-right font-semibold">Deudor</th>
                                        <th className="px-4 py-2 text-right font-semibold">Acreedor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Bloque 1: Activo Fijo (No Corriente) */}
                                    <FilaBloqueBS label="Activo Fijo (No Corriente)" />
                                    {renderFilasBS(calcBS.activoFijo || [])}

                                    {/* Bloque 2: Activo Corriente */}
                                    <FilaBloqueBS label="Activo Corriente" />
                                    {renderFilasBS(calcBS.activoCorriente || [])}

                                    {/* Bloque 3: Pasivo (Obligaciones) */}
                                    <FilaBloqueBS label="Pasivo (Obligaciones)" />
                                    {renderFilasBS(calcBS.pasivo || [])}

                                    {/* Bloque 4: Capital / Patrimonio Neto */}
                                    <FilaBloqueBS label="Capital / Patrimonio Neto" />
                                    {renderFilasBS(calcBS.capital || [])}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#1E3A5F] text-white font-bold">
                                        <td colSpan="3" className="px-4 py-3 text-sm uppercase tracking-wide">Totales Generales</td>
                                        <td className="px-4 py-3 text-right font-mono">{fmt(calcBS.totalDebe)}</td>
                                        <td className="px-4 py-3 text-right font-mono">{fmt(calcBS.totalHaber)}</td>
                                        <td className="px-4 py-3 text-right font-mono">{fmt(calcBS.totalSaldoDeudor)}</td>
                                        <td className="px-4 py-3 text-right font-mono">{fmt(calcBS.totalSaldoAcreedor)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* Sin datos */}
                {!cargando && reporteActivo && datos !== null && totalRegistros === 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
                        <span className="text-4xl block mb-3">📭</span>
                        <p className="text-gray-500 font-medium">No hay datos para este reporte</p>
                        <p className="text-gray-400 text-sm mt-1">
                            Verifica que existan pólizas registradas en: {obtenerLeyendaPeriodo()}
                        </p>

                    </div>
                )}
            </main>
        </div>
    );
}

export default Reportes;
