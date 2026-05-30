import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import hojaTrabajoService from '../services/hojaTrabajoService';
import Toast from './Toast';

const ANIOS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
const MESES = [
    { value: 1,  label: 'Enero'      }, { value: 2,  label: 'Febrero'    },
    { value: 3,  label: 'Marzo'      }, { value: 4,  label: 'Abril'      },
    { value: 5,  label: 'Mayo'       }, { value: 6,  label: 'Junio'      },
    { value: 7,  label: 'Julio'      }, { value: 8,  label: 'Agosto'     },
    { value: 9,  label: 'Septiembre' }, { value: 10, label: 'Octubre'    },
    { value: 11, label: 'Noviembre'  }, { value: 12, label: 'Diciembre'  },
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const n = (v) => parseFloat(v) || 0;
const fmt = (v) => v > 0 ? v.toFixed(2) : '—';
const fmtSum = (v) => v.toFixed(2);

function calcularFila(s) {
    const d  = n(s.SALDO_DEUDOR);
    const a  = n(s.SALDO_ACREEDOR);
    const ad = n(s.AJUSTE_DEBE);
    const ah = n(s.AJUSTE_HABER);

    const neto = (d - a) + (ad - ah);
    const sajD = neto > 0 ? neto : 0;
    const sajA = neto < 0 ? Math.abs(neto) : 0;
    const id = String(s.CUENTA_ID || '').trim();
    const esResultados = ['4','5','6'].some(p => id.startsWith(p));
    const esBalance    = ['1','2','3'].some(p => id.startsWith(p));

    return {
        d, a, ad, ah, sajD, sajA,
        perdida:  esResultados ? sajD : 0,
        ganancia: esResultados ? sajA : 0,
        activo:   esBalance    ? sajD : 0,
        pasPat:   esBalance    ? sajA : 0,
    };
}

/* ─── Componente principal ────────────────────────────────────────────── */
function HojaTrabajoSaldos() {
    const navigate  = useNavigate();
    const { usuario } = useAuth();
    const tablaRef  = useRef(null);
    
    /* Estado principal */
    const [saldos,    setSaldos]    = useState([]);
    const [mensaje,   setMensaje]   = useState({ texto: '', tipo: '' });
    const [cargando,  setCargando]  = useState(false);
    const [generado,  setGenerado]  = useState(false);
    const [sinDatos,  setSinDatos]  = useState(false);
    const [filtro,    setFiltro]    = useState({ ANIO: '', MES: '' });
    const [periodoLabel, setPeriodoLabel] = useState('');

    /* Estado modal edición manual */
    const [modalEditar,   setModalEditar]   = useState(false);
    const [modalEliminar, setModalEliminar] = useState({ visible: false, anio: null, mes: null, cuentaId: null });
    const [formEditar,    setFormEditar]    = useState({
        ANIO: '', MES: '', CUENTA_ID: '', NOMBRE_CUENTA: '',
        SALDO_DEUDOR: 0, SALDO_ACREEDOR: 0, AJUSTE_DEBE: 0, AJUSTE_HABER: 0
    });

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000);
    };

    /* ── Generar hoja por período ────────────────────────────────────── */
    const handleGenerarHoja = async () => {
        if (!filtro.ANIO || !filtro.MES) {
            mostrarMensaje('⚠️ Seleccione un Año y un Mes para consolidar el reporte.', 'advertencia');
            return;
        }
        try {
            setCargando(true);
            setSinDatos(false);
            setSaldos([]);

            const res   = await hojaTrabajoService.getByPeriodo(Number(filtro.ANIO), Number(filtro.MES));
            const datos = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);

            setSaldos(datos);
            setGenerado(true);
            setSinDatos(datos.length === 0);
            
            const mesLabel = MESES.find(m => m.value === Number(filtro.MES))?.label ?? filtro.MES;
            setPeriodoLabel(`${mesLabel} ${filtro.ANIO}`);
            
            if (datos.length > 0) {
                mostrarMensaje(`✅ Hoja consolidada: ${datos.length} cuenta(s) del período ${mesLabel} ${filtro.ANIO}.`, 'exito');
            }
        } catch (err) {
            console.error('Error al generar hoja:', err);
            mostrarMensaje('🚨 Error al conectar con Oracle. Verifique el servidor.', 'error');
            setSinDatos(true);
        } finally {
            setCargando(false);
        }
    };

    const handleRestablecer = () => {
        setSaldos([]);
        setGenerado(false);
        setSinDatos(false);
        setFiltro({ ANIO: '', MES: '' });
        setPeriodoLabel('');
    };

    const handleChangeFiltro = (e) => {
        const val = e.target.value === '' ? '' : Number(e.target.value);
        setFiltro(prev => ({ ...prev, [e.target.name]: val }));
    };

    const handleAbrirEditar = (s) => {
        setFormEditar({ ...s });
        setModalEditar(true);
    };

    const handleGuardarAjuste = async () => {
        try {
            await hojaTrabajoService.update(
                formEditar.ANIO, formEditar.MES, formEditar.CUENTA_ID,
                formEditar, usuario.USER_ID
            );
            setModalEditar(false);
            mostrarMensaje('Ajuste guardado y auditado correctamente.', 'exito');
            handleGenerarHoja();
        } catch (err) { 
            mostrarMensaje('Error al guardar ajuste', 'error'); 
        }
    };

    const confirmarEliminar = (anio, mes, cuentaId) =>
        setModalEliminar({ visible: true, anio, mes, cuentaId });

    const handleEliminar = async () => {
        try {
            await hojaTrabajoService.delete(
                modalEliminar.anio, modalEliminar.mes, modalEliminar.cuentaId, usuario.USER_ID
            );
            setModalEliminar({ visible: false, anio: null, mes: null, cuentaId: null });
            mostrarMensaje('Registro eliminado de la caché.', 'exito');
            handleGenerarHoja();
        } catch (err) { 
            mostrarMensaje('Error al eliminar registro', 'error'); 
        }
    };

    const exportarExcel = () => {
        if (!tablaRef.current) return;
        const html  = `<html><head><meta charset="UTF-8">
            <style>
                table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:9px}
                th,td{border:1px solid #888;padding:3px 7px}
                th{background:#1E3A5F;color:white}
            </style></head><body>${tablaRef.current.outerHTML}</body></html>`;
        const blob  = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        a.href      = url;
        a.download  = `HojaTrabajo_${filtro.ANIO}_${filtro.MES}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportarPDF = () => {
        const prev = document.getElementById('_ht_print_styles');
        if (prev) prev.remove();
        const style = document.createElement('style');
        style.id    = '_ht_print_styles';
        style.textContent = `
            @media print {
                @page { size: A3 landscape; margin: 8mm; }
                body * { visibility: hidden !important; }
                .seccion-reporte, .seccion-reporte * { visibility: visible !important; }
                .seccion-reporte { position: absolute; inset: 0; font-size: 8px; font-family: Arial, sans-serif; }
                .seccion-reporte table { border-collapse: collapse; width: 100%; }
                .seccion-reporte th, .seccion-reporte td { border: 1px solid #999; padding: 2px 4px; }
                .seccion-reporte th { background: #1E3A5F !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none !important; }
            }`;
        document.head.appendChild(style);
        window.print();
    };

    /* ── Estilos comunes ─────────────────────────────────────────────── */
    const inputClass  = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent";
    const labelClass  = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";
    const selectClass = "border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]";

    /* ── Cálculos agregados para el pie de página ────────────────────── */
    const totales = saldos.reduce((acc, s) => {
        const f = calcularFila(s);
        return {
            d:  acc.d  + f.d,  a:   acc.a   + f.a,
            ad: acc.ad + f.ad, ah:  acc.ah  + f.ah,
            s5: acc.s5 + f.sajD, s6: acc.s6 + f.sajA,
            s7: acc.s7 + f.perdida, s8: acc.s8 + f.ganancia,
            s9: acc.s9 + f.activo, s10: acc.s10 + f.pasPat,
        };
    }, { d:0, a:0, ad:0, ah:0, s5:0, s6:0, s7:0, s8:0, s9:0, s10:0 });

    const utilResultados = totales.s8 - totales.s7;
    const utilBalance    = totales.s9 - totales.s10;
    const balanzaDescuadrada = Math.abs(totales.d - totales.a) > 0.01;

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />

            {/* HEADER */}
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg no-print">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📊</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Hoja de Trabajo</h1>
                            <p className="text-blue-200 text-sm">
                                Motor analítico de 10 columnas · Consolidación automática desde pólizas Oracle
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-all">
                        <span>← Regresar</span>
                    </button>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-6 py-7">

                {/* ── PANEL DE GENERACIÓN ──────────────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-5 no-print">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                        <span className="text-lg">🗓️</span>
                        <div>
                            <h2 className="text-[#1E3A5F] font-bold text-base">Generar Hoja de Trabajo</h2>
                            <p className="text-gray-400 text-xs">
                                Seleccione el período contable. El sistema consolidará automáticamente todas las pólizas autorizadas desde Oracle.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className={labelClass}>Año</label>
                            <select name="ANIO" value={filtro.ANIO} onChange={handleChangeFiltro} className={selectClass}>
                                <option value="">— Año —</option>
                                {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Mes</label>
                            <select name="MES" value={filtro.MES} onChange={handleChangeFiltro} className={selectClass}>
                                <option value="">— Mes —</option>
                                {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        
                        {/* Corrección en el render condicional interno del string */}
                        <button
                            onClick={handleGenerarHoja}
                            disabled={cargando}
                            className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#2a4f7c] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">
                            {cargando ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    <span>Consolidando...</span>
                                </>
                            ) : (
                                <span>🔍 Generar Hoja de Trabajo</span>
                            )}
                        </button>
                        
                        {generado && (
                            <button
                                onClick={handleRestablecer}
                                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-semibold transition-all border border-gray-300">
                                <span>🔄 Nuevo período</span>
                            </button>
                        )}
                        {generado && periodoLabel && (
                            <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-semibold">
                                📅 {periodoLabel}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── AVISOS DE CONTROL ────────────────────────────────── */}
                {sinDatos && !cargando && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-5 py-4 mb-5 text-sm font-medium no-print">
                        <span>💡 No se encontraron movimientos contables autorizados en Oracle para el período seleccionado. Verifique que existan pólizas con estado <strong>AUTORIZADA</strong> en ese mes y año.</span>
                    </div>
                )}

                {generado && !sinDatos && balanzaDescuadrada && (
                    <div className="bg-red-50 border border-red-400 text-red-700 rounded-xl px-5 py-4 mb-5 text-sm font-semibold no-print">
                        <span>🚨 Error de Integridad: La Balanza de Comprobación inicial se encuentra descuadrada. El total Deudor ({fmtSum(totales.d)}) no coincide con el total Acreedor ({fmtSum(totales.a)}). Revise las pólizas capturadas en Oracle.</span>
                    </div>
                )}

                {/* ── TABLA PRINCIPAL ──────────────────────────────────── */}
                {(generado || saldos.length > 0) && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden seccion-reporte">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3 no-print">
                            <div>
                                <h2 className="text-[#1E3A5F] font-bold text-base">
                                    <span>Hoja de Trabajo Analítica</span>
                                    {periodoLabel && <span className="ml-2 text-sm font-normal text-gray-400">— {periodoLabel}</span>}
                                </h2>
                                <p className="text-gray-400 text-xs mt-0.5">{saldos.length} cuenta(s) · Columnas 1–10 calculadas automáticamente</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm">
                                    <span>🟢 Exportar Excel</span>
                                </button>
                                <button onClick={exportarPDF} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm">
                                    <span>🔴 Exportar PDF</span>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table ref={tablaRef} className="w-full text-[11px] border-collapse">
                                <thead>
                                    <tr className="bg-[#1E3A5F] text-white">
                                        <th colSpan={4} className="px-3 py-2 text-left border-r border-blue-800 uppercase tracking-wider font-bold text-[10px]">Datos de la Cuenta</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-blue-800 uppercase tracking-wider font-bold text-[10px] bg-[#163059]">1–2: Balanza Saldos</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-blue-800 uppercase tracking-wider font-bold text-[10px] bg-[#1E3A5F]">3–4: Ajustes Período</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-blue-800 uppercase tracking-wider font-bold text-[10px] bg-[#163059]">5–6: Saldos Ajustados</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-blue-800 uppercase tracking-wider font-bold text-[10px] bg-[#1E3A5F]">7–8: Est. Resultados</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-blue-800 uppercase tracking-wider font-bold text-[10px] bg-[#163059]">9–10: Balance General</th>
                                        <th rowSpan={2} className="px-3 py-2 text-center font-bold uppercase text-[10px] tracking-wider no-print">Acciones</th>
                                    </tr>
                                    <tr className="bg-[#2a4f7c] text-white text-[10px]">
                                        <th className="px-2 py-1.5 text-center font-semibold border-r border-blue-700 w-10">Año</th>
                                        <th className="px-2 py-1.5 text-center font-semibold border-r border-blue-700 w-8">Mes</th>
                                        <th className="px-2 py-1.5 text-left font-semibold border-r border-blue-700 w-16">Código</th>
                                        <th className="px-2 py-1.5 text-left font-semibold border-r border-blue-700 min-w-[120px]">Nombre Cuenta</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 bg-[#163059]/60 w-20">Deudor</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 bg-[#163059]/60 w-20">Acreedor</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 w-20">Debe</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 w-20">Haber</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 bg-[#163059]/60 w-20">Deudor</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 bg-[#163059]/60 w-20">Acreedor</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 w-20">Pérdida</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 w-20">Ganancia</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 bg-[#163059]/60 w-20">Activo</th>
                                        <th className="px-2 py-1.5 text-right font-semibold border-r border-blue-700 bg-[#163059]/60 w-20">Pas+Pat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saldos.map((s, i) => {
                                        const f = calcularFila(s);
                                        const llaveFila = `fila-dinamica-${s.ANIO}-${s.MES}-${s.CUENTA_ID}-${i}`;
                                        return (
                                            <tr key={llaveFila} className={`border-b border-gray-200 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                                                <td className="px-2 py-1.5 text-center font-mono text-gray-500">{s.ANIO}</td>
                                                <td className="px-2 py-1.5 text-center text-gray-600">{s.MES}</td>
                                                <td className="px-2 py-1.5 text-left font-mono font-semibold text-gray-600 border-r border-gray-100">{s.CUENTA_ID}</td>
                                                <td className="px-2 py-1.5 text-left font-medium text-gray-800 border-r border-gray-100 max-w-[160px] truncate" title={s.NOMBRE_CUENTA}>{s.NOMBRE_CUENTA}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-gray-700 bg-slate-50/60">{fmt(f.d)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-gray-700 bg-slate-50/60 border-r border-gray-100">{fmt(f.a)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-gray-700">{fmt(f.ad)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-gray-700 border-r border-gray-100">{fmt(f.ah)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono font-medium text-gray-900 bg-slate-50/60">{fmt(f.sajD)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono font-medium text-gray-900 bg-slate-50/60 border-r border-gray-100">{fmt(f.sajA)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-red-600">{fmt(f.perdida)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-green-700 border-r border-gray-100">{fmt(f.ganancia)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-blue-700 bg-slate-50/60">{fmt(f.activo)}</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-blue-900 bg-slate-50/60 border-r border-gray-100">{fmt(f.pasPat)}</td>
                                                <td className="px-2 py-1.5 text-center whitespace-nowrap no-print">
                                                    <button onClick={() => handleAbrirEditar(s)} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-2 py-0.5 rounded text-[10px] font-medium mr-1 transition-all">Ajustar</button>
                                                    <button onClick={() => confirmarEliminar(s.ANIO, s.MES, s.CUENTA_ID)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-medium transition-all">✕</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Cambiado a renderizado condicional válido dentro de tbody para evitar caídas */}
                                    {sinDatos && (
                                        <tr key="fila-bloque-sin-datos-warning">
                                            <td colSpan={15} className="px-4 py-8 text-center text-gray-400 text-xs italic">
                                                <span>Sin registros para este período.</span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className={`font-bold border-t-2 border-gray-400 text-[10px] ${balanzaDescuadrada ? 'bg-red-100' : 'bg-gray-100'}`}>
                                        <td colSpan={4} className="px-3 py-2 text-center text-gray-700 uppercase tracking-widest font-bold">
                                            <span>Subtotales </span>
                                            {balanzaDescuadrada && <span className="ml-2 text-red-600 text-[9px] not-italic">⚠ Descuadre</span>}
                                        </td>
                                        <td className="px-2 py-2 text-right font-mono">{fmtSum(totales.d)}</td>
                                        <td className="px-2 py-2 text-right font-mono border-r border-gray-300">{fmtSum(totales.a)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmtSum(totales.ad)}</td>
                                        <td className="px-2 py-2 text-right font-mono border-r border-gray-300">{fmtSum(totales.ah)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmtSum(totales.s5)}</td>
                                        <td className="px-2 py-2 text-right font-mono border-r border-gray-300">{fmtSum(totales.s6)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-red-700">{fmtSum(totales.s7)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-green-700 border-r border-gray-300">{fmtSum(totales.s8)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-blue-700">{fmtSum(totales.s9)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-blue-900 border-r border-gray-300">{fmtSum(totales.s10)}</td>
                                        <td className="bg-white no-print"></td>
                                    </tr>
                                    <tr className="bg-amber-50 text-[10px] font-semibold italic border-b border-gray-300">
                                        <td colSpan={4} className="px-3 py-1.5 text-center uppercase tracking-widest text-amber-800 font-bold not-italic">
                                            <span>{utilResultados >= 0 ? '✦ Utilidad del Ejercicio' : '✦ Pérdida del Ejercicio'}</span>
                                        </td>
                                        <td className="border-r border-gray-200 bg-gray-50"></td>
                                        <td className="border-r border-gray-200 bg-gray-50"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200 bg-gray-50"></td>
                                        <td className="border-r border-gray-200 bg-gray-50"></td>
                                        <td className="px-2 py-1.5 text-right font-mono text-red-700">{utilResultados < 0 ? fmtSum(Math.abs(utilResultados)) : '—'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-green-700 border-r border-gray-300">{utilResultados >= 0 ? fmtSum(utilResultados) : '—'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-blue-700">{utilBalance < 0 ? fmtSum(Math.abs(utilBalance)) : '—'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-blue-900 border-r border-gray-300">{utilBalance >= 0 ? fmtSum(utilBalance) : '—'}</td>
                                        <td className="bg-white no-print"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default HojaTrabajoSaldos;