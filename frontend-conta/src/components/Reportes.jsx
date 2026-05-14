import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useState, useMemo, useCallback } from 'react';
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

const fmtSigned = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return (n < 0 ? `(${fmt(Math.abs(n))})` : fmt(n));
};

// FIX #1 — Formatea fecha ISO → DD/MM/YYYY sin problemas de zona horaria
const fmtFecha = (raw) => {
    if (!raw) return '';
    const parte = String(raw).substring(0, 10);
    const [y, m, d] = parte.split('-');
    if (!y || !m || !d) return raw;
    return `${d}/${m}/${y}`;
};

// ─────────────────────────────────────────────
// SUB-COMPONENTES REUTILIZABLES
// ─────────────────────────────────────────────

/** Fila de cuenta individual con indentación */
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

/** Fila de subtotal/total con estilo destacado */
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

/** Título de sección dentro del reporte */
const TituloSeccion = ({ children, color = 'text-[#1E3A5F]' }) => (
    <div className={`px-4 py-2 mt-4 mb-1 font-bold text-xs uppercase tracking-widest ${color} border-b-2 border-current`}>
        {children}
    </div>
);

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
function Reportes() {
    const navigate = useNavigate();
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [reporteActivo, setReporteActivo] = useState(null);
    const [datos, setDatos] = useState([]);
    const [datosCrudos, setDatosCrudos] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [filtros, setFiltros] = useState({ cuenta: '', fechaDesde: '', fechaHasta: '' });

    const mostrarMensaje = useCallback((texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    }, []);

    // ── Carga de reportes ──────────────────────
    const cargarReporte = useCallback(async (tipo) => {
        setCargando(true);
        setReporteActivo(tipo);
        setDatos([]);
        setDatosCrudos([]);
        setFiltros({ cuenta: '', fechaDesde: '', fechaHasta: '' });
        try {
            let res;
            if (tipo === 'libro-diario')         res = await reportesService.getLibroDiario();
            else if (tipo === 'balance-general')  res = await reportesService.getBalanceGeneral();
            else if (tipo === 'estado-resultados') res = await reportesService.getEstadoResultados();
            else if (tipo === 'balance-saldos')   res = await reportesService.getBalanceSaldos();

            const data = res.data;
            setDatosCrudos(data);
            setDatos(data);
        } catch {
            mostrarMensaje('Error al cargar el reporte', 'error');
        } finally {
            setCargando(false);
        }
    }, [mostrarMensaje]);

    // ── Filtros ────────────────────────────────
    const aplicarFiltros = useCallback((fuente, f) => {
        const busqueda = f.cuenta.trim().toLowerCase();

        if (reporteActivo === 'libro-diario') {
            const resultado = Array.isArray(fuente) ? [...fuente] : [];
            if (!busqueda) return resultado;
            return resultado.filter(p =>
                p.movimientos?.some(m =>
                    String(m.CUENTA_ID).toLowerCase().includes(busqueda) ||
                    (m.NOMBRE_CUENTA && m.NOMBRE_CUENTA.toLowerCase().includes(busqueda))
                )
            );
        }

        if (reporteActivo === 'balance-saldos') {
            const cuentas = fuente?.cuentas || (Array.isArray(fuente) ? fuente : []);
            if (!busqueda) return cuentas;
            return cuentas.filter(c =>
                String(c.CUENTA_ID).toLowerCase().includes(busqueda) ||
                (c.NOMBRE && c.NOMBRE.toLowerCase().includes(busqueda))
            );
        }

        const arr = Array.isArray(fuente) ? fuente : [];
        if (!busqueda) return arr;
        return arr.filter(d =>
            String(d.CUENTA_ID).toLowerCase().includes(busqueda) ||
            (d.NOMBRE && d.NOMBRE.toLowerCase().includes(busqueda))
        );
    }, [reporteActivo]);

    const handleFiltro = (e) => {
        const nuevosFiltros = { ...filtros, [e.target.name]: e.target.value };
        setFiltros(nuevosFiltros);
        setDatos(aplicarFiltros(datosCrudos, nuevosFiltros));
    };

    const limpiarFiltros = () => {
        const f = { cuenta: '', fechaDesde: '', fechaHasta: '' };
        setFiltros(f);
        setDatos(datosCrudos);
    };

    // ── Datos procesados con useMemo ───────────
    const datosArray = useMemo(() => {
        if (!datos) return [];
        if (reporteActivo === 'balance-saldos') return datos?.cuentas || (Array.isArray(datos) ? datos : []);
        return Array.isArray(datos) ? datos : [];
    }, [datos, reporteActivo]);

    // Estado de Resultados — cálculos en cascada
    const calcER = useMemo(() => {
        if (reporteActivo !== 'estado-resultados') return {};
        const ingresos  = datosArray.filter(d => d.RUBRO === 'GANANCIA');
        const costos    = datosArray.filter(d => d.RUBRO === 'COSTO');
        const gastos    = datosArray.filter(d => d.RUBRO === 'PERDIDA');
        const totalIngresos = ingresos.reduce((s, d) => s + (parseFloat(d.SALDO) || 0), 0);
        const totalCostos   = costos.reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0);
        const utilidadBruta = totalIngresos - totalCostos;
        const totalGastos   = gastos.reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0);
        const utilidadNeta  = utilidadBruta - totalGastos;
        return { ingresos, costos, gastos, totalIngresos, totalCostos, utilidadBruta, totalGastos, utilidadNeta };
    }, [datosArray, reporteActivo]);

    // Balance General — clasificado
    const calcBG = useMemo(() => {
        if (reporteActivo !== 'balance-general') return {};
        const activoCorriente   = datosArray.filter(d => d.RUBRO === 'ACTIVO' && d.SUB_RUBRO?.toLowerCase() === 'corriente');
        const activoNoCorriente = datosArray.filter(d => d.RUBRO === 'ACTIVO' && d.SUB_RUBRO?.toLowerCase() !== 'corriente');
        const pasivoCorriente   = datosArray.filter(d => d.RUBRO === 'PASIVO' && d.SUB_RUBRO?.toLowerCase() === 'corriente');
        const pasivoNoCorriente = datosArray.filter(d => d.RUBRO === 'PASIVO' && d.SUB_RUBRO?.toLowerCase() !== 'corriente');
        const patrimonio         = datosArray.filter(d => d.RUBRO === 'PATRIMONIO');
        const sumActivo = (arr) => arr.reduce((s, d) => s + (parseFloat(d.SALDO) || 0), 0);
        const sumPasivo = (arr) => arr.reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0);
        const totalActivo        = sumActivo(datosArray.filter(d => d.RUBRO === 'ACTIVO'));
        const totalPasivo        = sumPasivo(datosArray.filter(d => d.RUBRO === 'PASIVO'));
        const totalPatrimonio    = sumPasivo(patrimonio);
        const totalPasivoPatrimonio = totalPasivo + totalPatrimonio;
        const cuadrado = Math.abs(totalActivo - totalPasivoPatrimonio) < 0.01;
        return {
            activoCorriente, activoNoCorriente, pasivoCorriente, pasivoNoCorriente, patrimonio,
            totalActivo, totalPasivo, totalPatrimonio, totalPasivoPatrimonio, cuadrado,
            sumActivo, sumPasivo,
        };
    }, [datosArray, reporteActivo]);

    // Balance de Saldos — totales
    const calcBS = useMemo(() => {
        if (reporteActivo !== 'balance-saldos') return {};
        const cuentas = datos?.cuentas || (Array.isArray(datos) ? datos : []);
        const totalDebe  = datos?.totales?.totalDebe  || cuentas.reduce((s, c) => s + (parseFloat(c.SUMA_DEBE) || 0), 0);
        const totalHaber = datos?.totales?.totalHaber || cuentas.reduce((s, c) => s + (parseFloat(c.SUMA_HABER) || 0), 0);
        const cuadrado   = datos?.cuadrado ?? Math.abs(totalDebe - totalHaber) < 0.01;
        const RUBROS_ACREEDORES = ['GANANCIA', 'PASIVO', 'PATRIMONIO'];
        const totalSaldoDeudor   = cuentas.reduce((s, c) => {
            const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
            if (esAcreedor) return s;
            return s + Math.abs(parseFloat(c.SALDO_FINAL) || 0);
        }, 0);
        const totalSaldoAcreedor = cuentas.reduce((s, c) => {
            const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
            if (!esAcreedor) return s;
            return s + Math.abs(parseFloat(c.SALDO_FINAL) || 0);
        }, 0);
        return { totalDebe, totalHaber, cuadrado, totalSaldoDeudor, totalSaldoAcreedor, RUBROS_ACREEDORES };
    }, [datos, reporteActivo]);

    // Libro Diario — totales globales
    const calcLD = useMemo(() => {
        if (reporteActivo !== 'libro-diario') return {};
        const totalDebe  = datosArray.reduce((s, p) => s + (p.totalDebe  || 0), 0);
        const totalHaber = datosArray.reduce((s, p) => s + (p.totalHaber || 0), 0);
        return { totalDebe, totalHaber };
    }, [datosArray, reporteActivo]);

    // FIX #3 — Helper para ordenar movimientos: Debe primero, Haber después
    const ordenarMovimientos = (movimientos = []) => {
        return [...movimientos].sort((a, b) => {
            const aEsDebe  = (parseFloat(a.DEBE)  || 0) > 0;
            const bEsDebe  = (parseFloat(b.DEBE)  || 0) > 0;
            if (aEsDebe && !bEsDebe) return -1;
            if (!aEsDebe && bEsDebe) return 1;
            return 0;
        });
    };

    // ── Exportar PDF ───────────────────────────
    const exportarPDF = () => {
        const doc = new jsPDF();
        const titulos = {
            'libro-diario':      'Libro Diario',
            'balance-general':   'Balance General',
            'estado-resultados': 'Estado de Resultados',
            'balance-saldos':    'Balance de Saldos',
        };

        // ── PDF LIBRO DIARIO — estilo formal igual que los otros ──
        if (reporteActivo === 'libro-diario') {
            const azul = [30, 58, 95];

            // Encabezado formal igual que Estado de Resultados / Balance General
            doc.setFillColor(...azul);
            doc.rect(0, 0, 210, 30, 'F');
            doc.setFontSize(9);
            doc.setTextColor(147, 197, 253);
            doc.text('REGISTRO CONTABLE', 105, 10, { align: 'center' });
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text('LIBRO DIARIO', 105, 19, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(147, 197, 253);
            doc.text(`Registro cronológico de pólizas contables  |  Generado: ${new Date().toLocaleDateString('es-GT')}`, 105, 26, { align: 'center' });

            let startY = 36;

            datosArray.forEach((partida) => {
                const fechaFormateada = fmtFecha(partida.FECHA);
                const movimientosOrdenados = ordenarMovimientos(partida.movimientos);

                autoTable(doc, {
                    startY,
                    head: [[
                        {
                            content: `Partida #${partida.NUM_POLIZA || partida.POLIZA_ID}   |   Fecha: ${fechaFormateada}   |   ${partida.TIPO_POLIZA}${partida.SINOPSIS ? '   —   ' + partida.SINOPSIS : ''}`,
                            colSpan: 4,
                        }
                    ]],
                    body: [
                        ...movimientosOrdenados.map(m => [
                            // FIX IDs VERTICALES: cellWidth fijo en columnStyles
                            String(m.CUENTA_ID),
                            m.NOMBRE_CUENTA,
                            (parseFloat(m.DEBE) || 0) > 0 ? fmt(m.DEBE) : '',
                            (parseFloat(m.HABER) || 0) > 0 ? fmt(m.HABER) : '',
                        ]),
                        [
                            { content: '', styles: { fontStyle: 'bold' } },
                            { content: 'TOTALES', styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: fmt(partida.totalDebe), styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: fmt(partida.totalHaber), styles: { fontStyle: 'bold', halign: 'right' } },
                        ],
                    ],
                    headStyles: {
                        fillColor: [30, 58, 95],
                        fontSize: 8,
                        textColor: 255,
                        fontStyle: 'bold',
                    },
                    // FIX IDs VERTICALES: cellWidth explícito para columna 0 (cuenta)
                    columnStyles: {
                        0: { cellWidth: 28, overflow: 'linebreak' },
                        1: { cellWidth: 'auto' },
                        2: { halign: 'right', cellWidth: 32 },
                        3: { halign: 'right', cellWidth: 32 },
                    },
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                    tableWidth: 'auto',
                    didDrawPage: (data) => {
                        if (data.pageNumber > 1) {
                            doc.setFillColor(...azul);
                            doc.rect(0, 0, 210, 30, 'F');
                            doc.setFontSize(9);
                            doc.setTextColor(147, 197, 253);
                            doc.text('REGISTRO CONTABLE', 105, 10, { align: 'center' });
                            doc.setFontSize(14);
                            doc.setTextColor(255, 255, 255);
                            doc.setFont(undefined, 'bold');
                            doc.text('LIBRO DIARIO', 105, 19, { align: 'center' });
                            doc.setFontSize(8);
                            doc.setFont(undefined, 'normal');
                            doc.setTextColor(147, 197, 253);
                            doc.text(`Registro cronológico de pólizas contables  |  Generado: ${new Date().toLocaleDateString('es-GT')}`, 105, 26, { align: 'center' });
                        }
                    },
                });

                startY = doc.lastAutoTable.finalY + 6;

                if (startY > 260) {
                    doc.addPage();
                    startY = 36;
                }
            });

            // Totales globales al final
            autoTable(doc, {
                startY,
                body: [
                    [
                        { content: 'TOTAL GENERAL DEL LIBRO', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: fmt(calcLD.totalDebe),  styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: fmt(calcLD.totalHaber), styles: { fontStyle: 'bold', halign: 'right' } },
                    ]
                ],
                columnStyles: {
                    2: { halign: 'right', cellWidth: 32 },
                    3: { halign: 'right', cellWidth: 32 },
                },
                styles: { fontSize: 9, fillColor: [30, 58, 95], textColor: 255 },
            });

        // ── PDF BALANCE DE SALDOS — estilo formal + IDs horizontales ──
        } else if (reporteActivo === 'balance-saldos') {
            const azul = [30, 58, 95];
            const RUBROS_ACREEDORES = ['GANANCIA', 'PASIVO', 'PATRIMONIO'];
            const cuentas = datosArray;

            // Encabezado formal igual que los otros
            doc.setFillColor(...azul);
            doc.rect(0, 0, 210, 30, 'F');
            doc.setFontSize(9);
            doc.setTextColor(147, 197, 253);
            doc.text('VERIFICACIÓN CONTABLE', 105, 10, { align: 'center' });
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text('BALANCE DE SALDOS', 105, 19, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(147, 197, 253);
            doc.text(`Comprobación matemática de todas las cuentas  |  Generado: ${new Date().toLocaleDateString('es-GT')}`, 105, 26, { align: 'center' });

            autoTable(doc, {
                head: [['Cuenta', 'Nombre', 'Rubro', 'Suma Debe', 'Suma Haber', 'Saldo Deudor', 'Saldo Acreedor']],
                body: [
                    ...cuentas.map(c => {
                        const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
                        const saldoAbs   = Math.abs(parseFloat(c.SALDO_FINAL) || 0);
                        return [
                            // FIX IDs VERTICALES: forzar string
                            String(c.CUENTA_ID),
                            c.NOMBRE,
                            c.RUBRO,
                            fmt(c.SUMA_DEBE),
                            fmt(c.SUMA_HABER),
                            !esAcreedor ? fmt(saldoAbs) : '',
                            esAcreedor  ? fmt(saldoAbs) : '',
                        ];
                    }),
                    [
                        { content: '', styles: { fontStyle: 'bold' } },
                        { content: 'TOTALES', styles: { fontStyle: 'bold' } },
                        { content: '', styles: { fontStyle: 'bold' } },
                        { content: fmt(calcBS.totalDebe),         styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: fmt(calcBS.totalHaber),        styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: fmt(calcBS.totalSaldoDeudor),  styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: fmt(calcBS.totalSaldoAcreedor),styles: { fontStyle: 'bold', halign: 'right' } },
                    ],
                ],
                headStyles: { fillColor: azul, fontSize: 7, textColor: 255, fontStyle: 'bold' },
                startY: 35,
                // FIX IDs VERTICALES: cellWidth explícito para columna 0 y numéricas
                columnStyles: {
                    0: { cellWidth: 22, overflow: 'linebreak' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 22 },
                    3: { halign: 'right', cellWidth: 26 },
                    4: { halign: 'right', cellWidth: 26 },
                    5: { halign: 'right', cellWidth: 26 },
                    6: { halign: 'right', cellWidth: 26 },
                },
                styles: { fontSize: 7, overflow: 'linebreak' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            // Banner de cuadre al final
            const cuadrado = calcBS.cuadrado;
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 4,
                body: [[
                    {
                        content: cuadrado
                            ? `✓  SISTEMA CUADRADO  |  Debe: ${fmt(calcBS.totalDebe)}  =  Haber: ${fmt(calcBS.totalHaber)}`
                            : `✗  DIFERENCIA  |  Debe: ${fmt(calcBS.totalDebe)}  ≠  Haber: ${fmt(calcBS.totalHaber)}`,
                        colSpan: 7,
                        styles: { fontStyle: 'bold', textColor: [255, 255, 255], halign: 'center', fontSize: 8 },
                    }
                ]],
                styles: { fillColor: cuadrado ? [21, 128, 61] : [185, 28, 28], cellPadding: { top: 4, bottom: 4 } },
                theme: 'plain',
            });

        // ── PDF ESTADO DE RESULTADOS — cascada con bloques y subtotales ──
        } else if (reporteActivo === 'estado-resultados') {
            const azul    = [30, 58, 95];
            const verde   = [21, 128, 61];
            const rojo    = [185, 28, 28];
            const naranja = [194, 65, 12];
            const gris1   = [241, 245, 249];

            // Helper para dibujar un bloque de cuentas + fila de total
            const bloqueER = (titulo, cuentas, totalLabel, totalValor, colorTitulo, esCosto, startY) => {
                autoTable(doc, {
                    startY,
                    body: [[{ content: titulo, colSpan: 3 }]],
                    styles: { fontSize: 8, fontStyle: 'bold', textColor: colorTitulo, fillColor: [255, 255, 255], cellPadding: { top: 6, bottom: 2, left: 14, right: 4 } },
                    theme: 'plain',
                    tableLineColor: colorTitulo,
                    tableLineWidth: 0.5,
                });
                let y = doc.lastAutoTable.finalY;

                autoTable(doc, {
                    startY: y,
                    body: cuentas.map(d => [
                        // FIX IDs VERTICALES: string + cellWidth fijo
                        { content: String(d.CUENTA_ID), styles: { textColor: [148, 163, 184], halign: 'left' } },
                        { content: d.NOMBRE, styles: { textColor: [51, 65, 85] } },
                        { content: esCosto ? `(${fmt(Math.abs(d.SALDO))})` : fmt(Math.abs(d.SALDO)), styles: { halign: 'right', textColor: esCosto ? rojo : [30, 41, 59] } },
                    ]),
                    // FIX IDs VERTICALES: cellWidth mínimo para que el id no se parta
                    columnStyles: {
                        0: { cellWidth: 35 },
                        2: { cellWidth: 38 },
                    },
                    styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 20, right: 4 }, overflow: 'linebreak' },
                    theme: 'plain',
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                });
                y = doc.lastAutoTable.finalY;

                autoTable(doc, {
                    startY: y,
                    body: [[
                        { content: totalLabel, colSpan: 2, styles: { fontStyle: 'bold', textColor: [30, 41, 59] } },
                        { content: esCosto ? `(${fmt(totalValor)})` : fmt(totalValor), styles: { fontStyle: 'bold', halign: 'right', textColor: esCosto ? rojo : [30, 41, 59] } },
                    ]],
                    columnStyles: {
                        2: { cellWidth: 38 },
                    },
                    styles: { fontSize: 8, fillColor: gris1, cellPadding: { top: 3, bottom: 3, left: 14, right: 4 } },
                    theme: 'plain',
                });
                return doc.lastAutoTable.finalY;
            };

            // Encabezado formal
            doc.setFillColor(...azul);
            doc.rect(0, 0, 210, 30, 'F');
            doc.setFontSize(9);
            doc.setTextColor(147, 197, 253);
            doc.text('ESTADO FINANCIERO', 105, 10, { align: 'center' });
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text('ESTADO DE RESULTADOS', 105, 19, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(147, 197, 253);
            doc.text(`Del período contable registrado  |  Generado: ${new Date().toLocaleDateString('es-GT')}`, 105, 26, { align: 'center' });

            let y = 36;

            if (calcER.ingresos?.length > 0) {
                y = bloqueER('INGRESOS', calcER.ingresos, 'Total Ingresos', calcER.totalIngresos, verde, false, y);
                y += 3;
            }

            if (calcER.costos?.length > 0) {
                y = bloqueER('COSTO DE VENTAS', calcER.costos, 'Total Costos', calcER.totalCostos, naranja, true, y);
                y += 3;
            }

            autoTable(doc, {
                startY: y,
                body: [[
                    { content: 'UTILIDAD BRUTA', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255] } },
                    { content: calcER.utilidadBruta < 0 ? `(${fmt(Math.abs(calcER.utilidadBruta))})` : fmt(calcER.utilidadBruta), styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255] } },
                ]],
                columnStyles: {
                    2: { cellWidth: 38 },
                },
                styles: { fontSize: 9, fillColor: calcER.utilidadBruta < 0 ? rojo : azul, cellPadding: { top: 4, bottom: 4, left: 14, right: 4 } },
                theme: 'plain',
            });
            y = doc.lastAutoTable.finalY + 5;

            if (calcER.gastos?.length > 0) {
                y = bloqueER('GASTOS OPERATIVOS', calcER.gastos, 'Total Gastos', calcER.totalGastos, rojo, true, y);
                y += 3;
            }

            const esUtilidad = calcER.utilidadNeta >= 0;
            autoTable(doc, {
                startY: y,
                body: [[
                    { content: esUtilidad ? '✓  UTILIDAD NETA DEL PERÍODO' : '✗  PÉRDIDA NETA DEL PERÍODO', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255], fontSize: 10 } },
                    { content: esUtilidad ? fmt(calcER.utilidadNeta) : `(${fmt(Math.abs(calcER.utilidadNeta))})`, styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255], fontSize: 10 } },
                ]],
                columnStyles: {
                    2: { cellWidth: 38 },
                },
                styles: { fillColor: esUtilidad ? azul : rojo, cellPadding: { top: 5, bottom: 5, left: 14, right: 4 } },
                theme: 'plain',
                didDrawCell: (data) => {
                    if (data.row.index === 0 && data.column.index === 2) {
                        const { x, y: cy, width, height } = data.cell;
                        doc.setDrawColor(255, 255, 255);
                        doc.setLineWidth(0.8);
                        doc.line(x, cy + height - 2, x + width, cy + height - 2);
                        doc.line(x, cy + height,     x + width, cy + height);
                    }
                },
            });

        // ── PDF BALANCE GENERAL — dos bloques + banner cuadre ──
        } else if (reporteActivo === 'balance-general') {
            const azul    = [30, 58, 95];
            const rojo    = [185, 28, 28];
            const verde   = [21, 128, 61];
            const gris1   = [241, 245, 249];

            const sumAbs = (arr) => arr.reduce((s, d) => s + Math.abs(parseFloat(d.SALDO) || 0), 0);
            const sum    = (arr) => arr.reduce((s, d) => s + (parseFloat(d.SALDO) || 0), 0);

            // Helper: dibuja un sub-bloque
            const subBloque = (titulo, cuentas, labelTotal, valorTotal, colorTitulo, startY) => {
                autoTable(doc, {
                    startY,
                    body: [[{ content: titulo, colSpan: 3 }]],
                    styles: { fontSize: 7, fontStyle: 'bold', textColor: colorTitulo, fillColor: [255,255,255], cellPadding: { top: 5, bottom: 1, left: 10, right: 4 } },
                    theme: 'plain',
                });
                let y = doc.lastAutoTable.finalY;
                autoTable(doc, {
                    startY: y,
                    body: cuentas.map(d => [
                        // FIX IDs VERTICALES: string + cellWidth fijo
                        { content: String(d.CUENTA_ID), styles: { textColor: [148,163,184], fontSize: 7 } },
                        { content: d.NOMBRE, styles: { textColor: [51,65,85], fontSize: 7 } },
                        { content: fmt(Math.abs(d.SALDO)), styles: { halign: 'right', textColor: [30,41,59], fontSize: 7 } },
                    ]),
                    // FIX IDs VERTICALES: cellWidth explícito
                    columnStyles: {
                        0: { cellWidth: 35 },
                        2: { cellWidth: 28 },
                    },
                    styles: { fontSize: 7, cellPadding: { top: 1.5, bottom: 1.5, left: 16, right: 4 }, overflow: 'linebreak' },
                    theme: 'plain',
                    alternateRowStyles: { fillColor: [248,250,252] },
                });
                y = doc.lastAutoTable.finalY;
                autoTable(doc, {
                    startY: y,
                    body: [[
                        { content: labelTotal, colSpan: 2, styles: { fontStyle: 'bold', textColor: [30,41,59], fontSize: 7 } },
                        { content: fmt(valorTotal), styles: { fontStyle: 'bold', halign: 'right', fontSize: 7 } },
                    ]],
                    columnStyles: {
                        2: { cellWidth: 28 },
                    },
                    styles: { fillColor: gris1, cellPadding: { top: 2, bottom: 2, left: 10, right: 4 } },
                    theme: 'plain',
                });
                return doc.lastAutoTable.finalY;
            };

            // Encabezado formal
            doc.setFillColor(...azul);
            doc.rect(0, 0, 210, 30, 'F');
            doc.setFontSize(9);  doc.setTextColor(147, 197, 253);
            doc.text('ESTADO DE SITUACIÓN FINANCIERA', 105, 10, { align: 'center' });
            doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold');
            doc.text('BALANCE GENERAL', 105, 19, { align: 'center' });
            doc.setFontSize(8);  doc.setFont(undefined, 'normal'); doc.setTextColor(147, 197, 253);
            doc.text(`Clasificado por disponibilidad  |  Generado: ${new Date().toLocaleDateString('es-GT')}`, 105, 26, { align: 'center' });

            // BLOQUE ACTIVOS
            autoTable(doc, {
                startY: 34,
                body: [[{ content: 'ACTIVOS', colSpan: 3 }]],
                styles: { fontSize: 9, fontStyle: 'bold', textColor: [255,255,255], fillColor: azul, cellPadding: { top: 3, bottom: 3, left: 10, right: 4 } },
                theme: 'plain',
            });

            const aC  = calcBG.activoCorriente   || [];
            const aNC = calcBG.activoNoCorriente  || [];
            let y = doc.lastAutoTable.finalY;
            y = subBloque('Activo Corriente',    aC,  'Total Activo Corriente',    sum(aC),  [37, 99, 235], y);
            y = subBloque('Activo No Corriente', aNC, 'Total Activo No Corriente', sum(aNC), [30, 58, 95],  y);

            autoTable(doc, {
                startY: y,
                body: [[
                    { content: 'TOTAL ACTIVOS', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255], fontSize: 9 } },
                    { content: fmt(calcBG.totalActivo), styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255], fontSize: 9 } },
                ]],
                columnStyles: {
                    2: { cellWidth: 28 },
                },
                styles: { fillColor: azul, cellPadding: { top: 4, bottom: 4, left: 10, right: 4 } },
                theme: 'plain',
            });
            y = doc.lastAutoTable.finalY + 6;

            // BLOQUE PASIVOS Y PATRIMONIO
            autoTable(doc, {
                startY: y,
                body: [[{ content: 'PASIVOS Y PATRIMONIO', colSpan: 3 }]],
                styles: { fontSize: 9, fontStyle: 'bold', textColor: [255,255,255], fillColor: rojo, cellPadding: { top: 3, bottom: 3, left: 10, right: 4 } },
                theme: 'plain',
            });

            const pC  = calcBG.pasivoCorriente   || [];
            const pNC = calcBG.pasivoNoCorriente  || [];
            const pat = calcBG.patrimonio         || [];
            y = doc.lastAutoTable.finalY;
            y = subBloque('Pasivo Corriente',    pC,  'Total Pasivo Corriente',    sumAbs(pC),  [185, 28, 28],  y);
            y = subBloque('Pasivo No Corriente', pNC, 'Total Pasivo No Corriente', sumAbs(pNC), [153, 27, 27],  y);

            autoTable(doc, {
                startY: y,
                body: [[
                    { content: 'TOTAL PASIVOS', colSpan: 2, styles: { fontStyle: 'bold', textColor: [30,41,59], fontSize: 8 } },
                    { content: fmt(calcBG.totalPasivo), styles: { fontStyle: 'bold', halign: 'right', fontSize: 8 } },
                ]],
                columnStyles: {
                    2: { cellWidth: 28 },
                },
                styles: { fillColor: [254, 226, 226], cellPadding: { top: 3, bottom: 3, left: 10, right: 4 } },
                theme: 'plain',
            });
            y = doc.lastAutoTable.finalY + 2;

            y = subBloque('Patrimonio', pat, 'Total Patrimonio', sumAbs(pat), [4, 120, 87], y);

            autoTable(doc, {
                startY: y,
                body: [[
                    { content: 'TOTAL PASIVO + PATRIMONIO', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255,255,255], fontSize: 9 } },
                    { content: fmt(calcBG.totalPasivoPatrimonio), styles: { fontStyle: 'bold', halign: 'right', textColor: [255,255,255], fontSize: 9 } },
                ]],
                columnStyles: {
                    2: { cellWidth: 28 },
                },
                styles: { fillColor: azul, cellPadding: { top: 4, bottom: 4, left: 10, right: 4 } },
                theme: 'plain',
            });
            y = doc.lastAutoTable.finalY + 6;

            // FIX BANNER CORTADO: texto más corto + tabla full-width
            const cuadrado = calcBG.cuadrado;
            autoTable(doc, {
                startY: y,
                tableWidth: 182,
                margin: { left: 14 },
                body: [[
                    {
                        content: cuadrado
                            ? `✓  BALANCE CUADRADO  |  ${fmt(calcBG.totalActivo)} = ${fmt(calcBG.totalPasivoPatrimonio)}`
                            : `✗  DESCUADRADO  |  Activos: ${fmt(calcBG.totalActivo)}  Pasivo + Pat: ${fmt(calcBG.totalPasivoPatrimonio)}`,
                        colSpan: 3,
                        styles: { fontStyle: 'bold', textColor: [255,255,255], halign: 'left', fontSize: 8 },
                    }
                ]],
                columnStyles: {
                    0: { cellWidth: 22 },
                    2: { cellWidth: 28 },
                },
                styles: { fillColor: cuadrado ? verde : rojo, cellPadding: { top: 4, bottom: 4 } },
                theme: 'plain',
            });
        }

        doc.save(`${titulos[reporteActivo]}.pdf`);
    };

    // ───────── Exportar Excel ─────────────────────────
    const exportarExcel = () => {
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
                    datosExcel.push({
                        Partida: p.NUM_POLIZA || p.POLIZA_ID,
                        Fecha: fmtFecha(p.FECHA),
                        Tipo: p.TIPO_POLIZA,
                        Sinopsis: p.SINOPSIS,
                        Cuenta: m.CUENTA_ID,
                        Nombre_Cuenta: m.NOMBRE_CUENTA,
                        Debe: parseFloat(m.DEBE) || 0,
                        Haber: parseFloat(m.HABER) || 0,
                    });
                });
            });
        } else if (reporteActivo === 'balance-saldos') {
            const RUBROS_ACREEDORES = ['GANANCIA', 'PASIVO', 'PATRIMONIO'];
            datosExcel = datosArray.map(c => {
                const esAcreedor = RUBROS_ACREEDORES.includes(c.RUBRO);
                const saldoAbs   = Math.abs(parseFloat(c.SALDO_FINAL) || 0);
                return {
                    Cuenta: c.CUENTA_ID,
                    Nombre: c.NOMBRE,
                    Rubro: c.RUBRO,
                    Suma_Debe:      parseFloat(c.SUMA_DEBE),
                    Suma_Haber:     parseFloat(c.SUMA_HABER),
                    Saldo_Deudor:   !esAcreedor ? saldoAbs : 0,
                    Saldo_Acreedor: esAcreedor  ? saldoAbs : 0,
                };
            });
        } else {
            datosExcel = datosArray.map(d => ({
                Cuenta: d.CUENTA_ID,
                Nombre: d.NOMBRE,
                Rubro: d.RUBRO,
                Sub_Rubro: d.SUB_RUBRO,
                Saldo: Math.abs(parseFloat(d.SALDO)),
            }));
        }

        const ws = XLSX.utils.json_to_sheet(datosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, titulos[reporteActivo]);
        XLSX.writeFile(wb, `${titulos[reporteActivo]}.xlsx`);
    };

    // ── Helpers de UI ──────────────────────────
    const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

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

    const totalRegistros = datosArray.length;

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

                {/* Selector de reporte */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Selecciona un Reporte</h2>
                    <div className="flex flex-wrap gap-3">
                        <BtnReporte tipo="libro-diario"       label="Libro Diario"         icon="📖" />
                        <BtnReporte tipo="balance-saldos"     label="Balance de Saldos"    icon="🔢" />
                        <BtnReporte tipo="estado-resultados"  label="Estado de Resultados" icon="📊" />
                        <BtnReporte tipo="balance-general"    label="Balance General"      icon="⚖️" />
                    </div>
                </div>

                {/* Panel de filtros + exportar */}
                {reporteActivo && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1">
                                <label className={labelClass}>🔍 Buscar Cuenta</label>
                                <input name="cuenta" value={filtros.cuenta} onChange={handleFiltro} className={inputClass} placeholder="ID o nombre de cuenta..." />
                            </div>
                            {reporteActivo === 'libro-diario' && (
                                <>
                                    <div className="flex-1">
                                        <label className={labelClass}>Fecha Desde</label>
                                        <input name="fechaDesde" value={filtros.fechaDesde} onChange={handleFiltro} type="date" className={inputClass} />
                                    </div>
                                    <div className="flex-1">
                                        <label className={labelClass}>Fecha Hasta</label>
                                        <input name="fechaHasta" value={filtros.fechaHasta} onChange={handleFiltro} type="date" className={inputClass} />
                                    </div>
                                </>
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={limpiarFiltros} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">
                                    Limpiar
                                </button>
                                {datosArray.length > 0 && (
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

                {/* Cargando */}
                {cargando && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
                        <div className="inline-block w-8 h-8 border-4 border-[#1E3A5F] border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-gray-400 text-sm">Cargando reporte...</p>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    LIBRO DIARIO — Cards por partida
                    CAMBIO: encabezado formal igual que los otros reportes
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'libro-diario' && datosArray.length > 0 && (
                    <div className="space-y-4">
                        {/* NUEVO encabezado formal, mismo estilo que ER y BG */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                                <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Registro Contable</p>
                                <h2 className="text-xl font-extrabold tracking-wide">LIBRO DIARIO</h2>
                                <p className="text-blue-200 text-xs mt-1">Registro cronológico de pólizas contables</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <span className="text-sm text-gray-400">{datosArray.length} partida(s)</span>
                        </div>

                        {datosArray.map((partida) => (
                            <div key={partida.POLIZA_ID} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* Header de partida */}
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

                                {/* Movimientos */}
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

                        {/* Total global */}
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
                    ESTADO DE RESULTADOS — Cascada vertical
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'estado-resultados' && datosArray.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                        <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Estado Financiero</p>
                            <h2 className="text-xl font-extrabold tracking-wide">ESTADO DE RESULTADOS</h2>
                            <p className="text-blue-200 text-xs mt-1">Del período contable registrado</p>
                        </div>

                        <div className="py-2">
                            {/* INGRESOS */}
                            <TituloSeccion color="text-green-700">Ingresos</TituloSeccion>
                            {calcER.ingresos?.map(d => (
                                <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} />
                            ))}
                            <FilaTotal label="Total Ingresos" valor={calcER.totalIngresos} nivel={1} />

                            {calcER.costos?.length > 0 && (
                                <>
                                    <TituloSeccion color="text-orange-700">Costo de Ventas</TituloSeccion>
                                    {calcER.costos.map(d => (
                                        <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} negativo />
                                    ))}
                                    <FilaTotal label="Total Costos" valor={calcER.totalCostos} nivel={1} negativo />
                                </>
                            )}

                            <FilaTotal
                                label="UTILIDAD BRUTA"
                                valor={calcER.utilidadBruta}
                                nivel={2}
                                negativo={calcER.utilidadBruta < 0}
                            />

                            <TituloSeccion color="text-red-700">Gastos Operativos</TituloSeccion>
                            {calcER.gastos?.map(d => (
                                <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} negativo />
                            ))}
                            <FilaTotal label="Total Gastos" valor={calcER.totalGastos} nivel={1} negativo />

                            <div className="mt-2">
                                <FilaTotal
                                    label={calcER.utilidadNeta >= 0 ? '✅ UTILIDAD NETA DEL PERÍODO' : '❌ PÉRDIDA NETA DEL PERÍODO'}
                                    valor={calcER.utilidadNeta}
                                    nivel={3}
                                    negativo={calcER.utilidadNeta < 0}
                                    doubleLine
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    BALANCE GENERAL — Clasificado
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'balance-general' && datosArray.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Estado de Situación Financiera</p>
                            <h2 className="text-xl font-extrabold tracking-wide">BALANCE GENERAL</h2>
                            <p className="text-blue-200 text-xs mt-1">Clasificado por disponibilidad</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                            {/* ACTIVOS */}
                            <div className="py-2">
                                <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                                    <h3 className="font-extrabold text-[#1E3A5F] text-sm uppercase tracking-widest">ACTIVOS</h3>
                                </div>
                                <TituloSeccion color="text-blue-600">Activo Corriente</TituloSeccion>
                                {calcBG.activoCorriente?.map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} />
                                ))}
                                <FilaTotal label="Total Activo Corriente" valor={calcBG.sumActivo?.(calcBG.activoCorriente || [])} nivel={1} />

                                <TituloSeccion color="text-blue-800">Activo No Corriente</TituloSeccion>
                                {calcBG.activoNoCorriente?.map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={d.SALDO} />
                                ))}
                                <FilaTotal label="Total Activo No Corriente" valor={calcBG.sumActivo?.(calcBG.activoNoCorriente || [])} nivel={1} />

                                <div className="mt-1">
                                    <FilaTotal label="TOTAL ACTIVOS" valor={calcBG.totalActivo} nivel={3} />
                                </div>
                            </div>

                            {/* PASIVOS + PATRIMONIO */}
                            <div className="py-2">
                                <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                                    <h3 className="font-extrabold text-red-800 text-sm uppercase tracking-widest">PASIVOS Y PATRIMONIO</h3>
                                </div>
                                <TituloSeccion color="text-red-600">Pasivo Corriente</TituloSeccion>
                                {calcBG.pasivoCorriente?.map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={Math.abs(d.SALDO)} />
                                ))}
                                <FilaTotal label="Total Pasivo Corriente" valor={calcBG.sumPasivo?.(calcBG.pasivoCorriente || [])} nivel={1} />

                                <TituloSeccion color="text-red-800">Pasivo No Corriente</TituloSeccion>
                                {calcBG.pasivoNoCorriente?.map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={Math.abs(d.SALDO)} />
                                ))}
                                <FilaTotal label="Total Pasivo No Corriente" valor={calcBG.sumPasivo?.(calcBG.pasivoNoCorriente || [])} nivel={1} />
                                <FilaTotal label="TOTAL PASIVOS" valor={calcBG.totalPasivo} nivel={2} />

                                <TituloSeccion color="text-emerald-700">Patrimonio</TituloSeccion>
                                {calcBG.patrimonio?.map(d => (
                                    <FilaCuenta key={d.CUENTA_ID} cuenta={d.CUENTA_ID} nombre={d.NOMBRE} saldo={Math.abs(d.SALDO)} />
                                ))}
                                <FilaTotal label="Total Patrimonio" valor={calcBG.totalPatrimonio} nivel={1} />

                                <div className="mt-1">
                                    <FilaTotal label="TOTAL PASIVO + PATRIMONIO" valor={calcBG.totalPasivoPatrimonio} nivel={3} />
                                </div>
                            </div>
                        </div>

                        {/* Banner de validación */}
                        <div className={`mx-4 mb-4 mt-2 rounded-xl px-5 py-3 flex items-center justify-between border ${
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
                    </div>
                )}

                {/* ════════════════════════════════════════
                    BALANCE DE SALDOS — Trial Balance
                ════════════════════════════════════════ */}
                {!cargando && reporteActivo === 'balance-saldos' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* ENCABEZADO FORMAL igual que los otros */}
                        <div className="bg-[#1E3A5F] text-white text-center px-6 py-5">
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Verificación Contable</p>
                            <h2 className="text-xl font-extrabold tracking-wide">BALANCE DE SALDOS</h2>
                            <p className="text-blue-200 text-xs mt-1">Comprobación matemática de todas las cuentas</p>
                        </div>

                        {/* Banner cuadre global */}
                        <div className={`mx-4 mt-4 rounded-xl px-5 py-3 flex items-center justify-between border ${
                            calcBS.cuadrado
                                ? 'bg-green-50 border-green-300 text-green-800'
                                : 'bg-red-50 border-red-300 text-red-800'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{calcBS.cuadrado ? '✅' : '❌'}</span>
                                <div>
                                    <p className="font-bold text-sm">{calcBS.cuadrado ? 'Sistema Cuadrado' : 'Sistema Descuadrado'}</p>
                                    <p className="text-xs opacity-70">{calcBS.cuadrado ? 'Todos los registros son consistentes' : 'Existe una diferencia entre Debe y Haber'}</p>
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
                                    {datosArray.map((c, index) => {
                                        const esAcreedor = (calcBS.RUBROS_ACREEDORES || []).includes(c.RUBRO);
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
                                    })}
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
                {!cargando && reporteActivo && datosArray.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
                        <span className="text-4xl block mb-3">📭</span>
                        <p className="text-gray-500 font-medium">No hay datos para este reporte</p>
                        <p className="text-gray-400 text-sm mt-1">Verifica que existan pólizas registradas en el período</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Reportes;

