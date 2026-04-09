import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import reportesService from '../services/reportesServices';
import Toast from './Toast';

function Reportes() {
    const navigate = useNavigate();
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [reporteActivo, setReporteActivo] = useState(null);
    const [datos, setDatos] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [filtros, setFiltros] = useState({ cuenta: '', fechaDesde: '', fechaHasta: '' });
    const [datosCrudos, setDatosCrudos] = useState([]);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarReporte = async (tipo) => {
        setCargando(true);
        setReporteActivo(tipo);
        setDatos([]);
        setDatosCrudos([]);
        try {
            let res;
            if (tipo === 'libro-diario') res = await reportesService.getLibroDiario();
            else if (tipo === 'balance-general') res = await reportesService.getBalanceGeneral();
            else if (tipo === 'estado-resultados') res = await reportesService.getEstadoResultados();
            setDatosCrudos(res.data);
            aplicarFiltros(res.data, filtros, tipo);
        } catch (err) {
            mostrarMensaje('Error al cargar el reporte', 'error');
        } finally {
            setCargando(false);
        }
    };

    const aplicarFiltros = (fuente, f, tipo) => {
        let resultado = [...fuente];
        const tipoActivo = tipo || reporteActivo;

        if (f.cuenta.trim() !== '') {
            const busqueda = f.cuenta.toLowerCase();
            if (tipoActivo === 'libro-diario') {
                resultado = resultado.filter(d =>
                    String(d.CUENTA_ID).toLowerCase().includes(busqueda) ||
                    (d.NOMBRE_CUENTA && d.NOMBRE_CUENTA.toLowerCase().includes(busqueda))
                );
            } else {
                resultado = resultado.filter(d =>
                    String(d.CUENTA_ID).toLowerCase().includes(busqueda) ||
                    (d.NOMBRE && d.NOMBRE.toLowerCase().includes(busqueda))
                );
            }
        }

        if (tipoActivo === 'libro-diario') {
            if (f.fechaDesde.trim() !== '') {
                resultado = resultado.filter(d => d.FECHA && d.FECHA >= f.fechaDesde);
            }
            if (f.fechaHasta.trim() !== '') {
                resultado = resultado.filter(d => d.FECHA && d.FECHA <= f.fechaHasta);
            }
        }

        setDatos(resultado);
    };

    const handleFiltro = (e) => {
        const nuevosFiltros = { ...filtros, [e.target.name]: e.target.value };
        setFiltros(nuevosFiltros);
        aplicarFiltros(datosCrudos, nuevosFiltros, reporteActivo);
    };

    const limpiarFiltros = () => {
        const f = { cuenta: '', fechaDesde: '', fechaHasta: '' };
        setFiltros(f);
        aplicarFiltros(datosCrudos, f, reporteActivo);
    };

    const totalActivos = datos.filter(d => d.RUBRO === 'ACTIVO').reduce((sum, d) => sum + (parseFloat(d.SALDO) || 0), 0);
    const totalPasivos = datos.filter(d => d.RUBRO === 'PASIVO').reduce((sum, d) => sum + (parseFloat(d.SALDO) || 0), 0);
    const totalGanancias = datos.filter(d => d.RUBRO === 'GANANCIA').reduce((sum, d) => sum + (parseFloat(d.SALDO) || 0), 0);
    const totalPerdidas = datos.filter(d => d.RUBRO === 'PERDIDA').reduce((sum, d) => sum + (parseFloat(d.SALDO) || 0), 0);
    const utilidadNeta = totalGanancias - totalPerdidas;

    const btnReporte = (tipo, label, icon) => (
        <button
            onClick={() => cargarReporte(tipo)}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                reporteActivo === tipo
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-[#1E3A5F] border-[#1E3A5F] hover:bg-[#f0f4fa]'
            }`}
        >
            <span className="text-xl">{icon}</span>
            {label}
        </button>
    );

const exportarPDF = () => {
    const doc = new jsPDF();
    
    const titulos = {
        'libro-diario': 'Libro Diario',
        'balance-general': 'Balance General',
        'estado-resultados': 'Estado de Resultados'
    };

    doc.setFontSize(18);
    doc.text(titulos[reporteActivo], 14, 20);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 30);

    let columnas = [];
    let filas = [];

    if (reporteActivo === 'libro-diario') {
        columnas = ['Póliza', 'Fecha', 'Tipo', 'Cuenta', 'Nombre Cuenta', 'Debe', 'Haber'];
        filas = datos.map(d => [d.POLIZA_ID, d.FECHA, d.TIPO_POLIZA, d.CUENTA_ID, d.NOMBRE_CUENTA, parseFloat(d.DEBE).toFixed(2), parseFloat(d.HABER).toFixed(2)]);
    } else if (reporteActivo === 'balance-general') {
        columnas = ['Cuenta', 'Nombre', 'Rubro', 'Saldo'];
        filas = datos.map(d => [d.CUENTA_ID, d.NOMBRE, d.RUBRO, parseFloat(d.SALDO).toFixed(2)]);
    } else if (reporteActivo === 'estado-resultados') {
        columnas = ['Cuenta', 'Nombre', 'Rubro', 'Saldo'];
        filas = datos.map(d => [d.CUENTA_ID, d.NOMBRE, d.RUBRO, parseFloat(d.SALDO).toFixed(2)]);
    }

    autoTable(doc, {
        head: [columnas],
        body: filas,
        startY: 40,
        headStyles: { fillColor: [30, 58, 95] },
        alternateRowStyles: { fillColor: [240, 244, 250] }
    });

    doc.save(`${titulos[reporteActivo]}.pdf`);
};

const exportarExcel = () => {
    const titulos = {
        'libro-diario': 'Libro Diario',
        'balance-general': 'Balance General',
        'estado-resultados': 'Estado de Resultados'
    };

    let datosExcel = [];

    if (reporteActivo === 'libro-diario') {
        datosExcel = datos.map(d => ({
            Poliza: d.POLIZA_ID,
            Fecha: d.FECHA,
            Tipo: d.TIPO_POLIZA,
            Cuenta: d.CUENTA_ID,
            Nombre_Cuenta: d.NOMBRE_CUENTA,
            Sinopsis: d.SINOPSIS,
            Debe: parseFloat(d.DEBE).toFixed(2),
            Haber: parseFloat(d.HABER).toFixed(2)
        }));
    } else if (reporteActivo === 'balance-general') {
        datosExcel = datos.map(d => ({
            Cuenta: d.CUENTA_ID,
            Nombre: d.NOMBRE,
            Rubro: d.RUBRO,
            Sub_Rubro: d.SUB_RUBRO,
            Saldo: parseFloat(d.SALDO).toFixed(2)
        }));
    } else if (reporteActivo === 'estado-resultados') {
        datosExcel = datos.map(d => ({
            Cuenta: d.CUENTA_ID,
            Nombre: d.NOMBRE,
            Rubro: d.RUBRO,
            Clasificacion: d.CLASIFICACION_HOJA,
            Saldo: parseFloat(d.SALDO).toFixed(2)
        }));
    }

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titulos[reporteActivo]);
    XLSX.writeFile(wb, `${titulos[reporteActivo]}.xlsx`);
};

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast mensaje={mensaje} />
            <header className="bg-[#1E3A5F] text-white px-8 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📈</span>
                        <div>
                            <h1 className="text-2xl font-bold tracking-wide">Reportes Financieros</h1>
                            <p className="text-blue-200 text-sm">Estados financieros y libro diario</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">← Regresar</button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-8">

                {/* Botones de reportes */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-[#1E3A5F] font-bold text-lg mb-5 pb-3 border-b border-gray-100">Selecciona un Reporte</h2>
                    <div className="flex flex-wrap gap-4">
                        {btnReporte('libro-diario', 'Libro Diario', '📖')}
                        {btnReporte('balance-general', 'Balance General', '⚖️')}
                        {btnReporte('estado-resultados', 'Estado de Resultados', '📊')}
                    </div>
                </div>

                {/* Panel de filtros — aparece cuando hay un reporte activo */}
                {reporteActivo && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                        <h2 className="text-[#1E3A5F] font-bold text-base mb-4 pb-2 border-b border-gray-100">🔍 Filtros del Reporte</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Buscar Cuenta</label>
                                <input
                                    name="cuenta"
                                    value={filtros.cuenta}
                                    onChange={handleFiltro}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
                                    placeholder="ID o nombre de cuenta..."
                                />
                            </div>
                            {reporteActivo === 'libro-diario' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Fecha Desde</label>
                                        <input
                                            name="fechaDesde"
                                            value={filtros.fechaDesde}
                                            onChange={handleFiltro}
                                            type="date"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Fecha Hasta</label>
                                        <input
                                            name="fechaHasta"
                                            value={filtros.fechaHasta}
                                            onChange={handleFiltro}
                                            type="date"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <button onClick={limpiarFiltros} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">
                                Limpiar filtros
                            </button>
                            <span className="text-gray-400 text-sm">{datos.length} registro(s) visible(s)</span>
                        </div>
                    </div>
                )}

                {reporteActivo && datos.length > 0 && (
                <div className="flex gap-3 mt-4">
                <button
                    onClick={exportarPDF}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
            📄 Exportar PDF
        </button>
        <button
            onClick={exportarExcel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
            📊 Exportar Excel
        </button>
    </div>
)}

                {/* Contenido del reporte */}
                {cargando && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <p className="text-gray-400 text-sm">Cargando reporte...</p>
                    </div>
                )}

                {/* Libro Diario */}
                {!cargando && reporteActivo === 'libro-diario' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-[#1E3A5F] font-bold text-lg">📖 Libro Diario</h2>
                            <p className="text-gray-400 text-sm">{datos.length} movimiento(s) registrado(s)</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#1E3A5F] text-white">
                                        <th className="px-4 py-3 text-left font-semibold">Póliza</th>
                                        <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                                        <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                                        <th className="px-4 py-3 text-left font-semibold">Cuenta</th>
                                        <th className="px-4 py-3 text-left font-semibold">Nombre Cuenta</th>
                                        <th className="px-4 py-3 text-left font-semibold">Sinopsis</th>
                                        <th className="px-4 py-3 text-right font-semibold">Debe</th>
                                        <th className="px-4 py-3 text-right font-semibold">Haber</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {datos.map((d, index) => (
                                        <tr key={`${d.POLIZA_ID}-${d.DETALLE_ID}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 font-mono text-gray-600">{d.POLIZA_ID}</td>
                                            <td className="px-4 py-3 text-gray-600">{d.FECHA}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{d.TIPO_POLIZA}</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-gray-600">{d.CUENTA_ID}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{d.NOMBRE_CUENTA}</td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">{d.SINOPSIS}</td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-700">{parseFloat(d.DEBE).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-700">{parseFloat(d.HABER).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#1E3A5F] text-white font-bold">
                                        <td colSpan="6" className="px-4 py-3">Totales</td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {datos.reduce((sum, d) => sum + (parseFloat(d.DEBE) || 0), 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {datos.reduce((sum, d) => sum + (parseFloat(d.HABER) || 0), 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* Balance General */}
                {!cargando && reporteActivo === 'balance-general' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-[#1E3A5F] font-bold text-lg">⚖️ Balance General</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Activos */}
                            <div>
                                <h3 className="text-[#1E3A5F] font-bold text-base mb-3 pb-2 border-b border-gray-200">ACTIVOS</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {datos.filter(d => d.RUBRO === 'ACTIVO').map((d, index) => (
                                            <tr key={d.CUENTA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-2 font-mono text-gray-600">{d.CUENTA_ID}</td>
                                                <td className="px-3 py-2 text-gray-800">{d.NOMBRE}</td>
                                                <td className="px-3 py-2 text-right font-mono text-gray-700">{parseFloat(d.SALDO).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-[#1E3A5F] text-white font-bold">
                                            <td colSpan="2" className="px-3 py-2">Total Activos</td>
                                            <td className="px-3 py-2 text-right font-mono">{totalActivos.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            {/* Pasivos */}
                            <div>
                                <h3 className="text-[#1E3A5F] font-bold text-base mb-3 pb-2 border-b border-gray-200">PASIVOS</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {datos.filter(d => d.RUBRO === 'PASIVO').map((d, index) => (
                                            <tr key={d.CUENTA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-2 font-mono text-gray-600">{d.CUENTA_ID}</td>
                                                <td className="px-3 py-2 text-gray-800">{d.NOMBRE}</td>
                                                <td className="px-3 py-2 text-right font-mono text-gray-700">{parseFloat(d.SALDO).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-[#1E3A5F] text-white font-bold">
                                            <td colSpan="2" className="px-3 py-2">Total Pasivos</td>
                                            <td className="px-3 py-2 text-right font-mono">{totalPasivos.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        {/* Resumen */}
                        <div className="px-6 pb-6">
                            <div className="bg-[#f0f4fa] rounded-lg p-4 border border-[#1E3A5F]/20">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Activos</p>
                                        <p className="text-xl font-bold text-[#1E3A5F]">{totalActivos.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Pasivos</p>
                                        <p className="text-xl font-bold text-[#1E3A5F]">{totalPasivos.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patrimonio</p>
                                        <p className="text-xl font-bold text-[#1E3A5F]">{(totalActivos - totalPasivos).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Estado de Resultados */}
                {!cargando && reporteActivo === 'estado-resultados' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-[#1E3A5F] font-bold text-lg">📊 Estado de Resultados</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Ganancias */}
                            <div>
                                <h3 className="text-green-700 font-bold text-base mb-3 pb-2 border-b border-gray-200">INGRESOS / GANANCIAS</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {datos.filter(d => d.RUBRO === 'GANANCIA').map((d, index) => (
                                            <tr key={d.CUENTA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-2 font-mono text-gray-600">{d.CUENTA_ID}</td>
                                                <td className="px-3 py-2 text-gray-800">{d.NOMBRE}</td>
                                                <td className="px-3 py-2 text-right font-mono text-green-700">{parseFloat(d.SALDO).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-green-700 text-white font-bold">
                                            <td colSpan="2" className="px-3 py-2">Total Ganancias</td>
                                            <td className="px-3 py-2 text-right font-mono">{totalGanancias.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            {/* Pérdidas */}
                            <div>
                                <h3 className="text-red-700 font-bold text-base mb-3 pb-2 border-b border-gray-200">GASTOS / PÉRDIDAS</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {datos.filter(d => d.RUBRO === 'PERDIDA').map((d, index) => (
                                            <tr key={d.CUENTA_ID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-2 font-mono text-gray-600">{d.CUENTA_ID}</td>
                                                <td className="px-3 py-2 text-gray-800">{d.NOMBRE}</td>
                                                <td className="px-3 py-2 text-right font-mono text-red-700">{parseFloat(d.SALDO).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-red-600 text-white font-bold">
                                            <td colSpan="2" className="px-3 py-2">Total Pérdidas</td>
                                            <td className="px-3 py-2 text-right font-mono">{totalPerdidas.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        {/* Utilidad Neta */}
                        <div className="px-6 pb-6">
                            <div className={`rounded-lg p-4 border ${utilidadNeta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilidad Neta</p>
                                        <p className="text-xs text-gray-400">Ganancias - Pérdidas</p>
                                    </div>
                                    <p className={`text-2xl font-bold ${utilidadNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {utilidadNeta >= 0 ? '+' : ''}{utilidadNeta.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sin datos */}
                {!cargando && reporteActivo && datos.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <span className="text-4xl block mb-3">📭</span>
                        <p className="text-gray-400 text-sm">No hay datos para mostrar en este reporte</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Reportes;