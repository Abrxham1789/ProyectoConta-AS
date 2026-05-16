const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

const handleError = (res, err) => {
    console.error('[Reportes Error]', err); 
    res.status(500).json({ message: 'Error interno al procesar el reporte solicitado.' });
};

// ─────────────────────────────────────────────
// 1. GET — Libro Diario (Mantenido y Seguro)
// ─────────────────────────────────────────────
router.get('/reportes/libro-diario', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes, tipo, fechaDesde, fechaHasta } = req.query;
        let whereClause = '';
        const binds = {};

        // EVALUACIÓN DE MODALIDAD DINÁMICA
        if (tipo === 'RANGO' && fechaDesde && fechaHasta) {
            whereClause = ' AND TRUNC(pc.FECHA) BETWEEN TO_DATE(:fechaDesde, \'YYYY-MM-DD\') AND TO_DATE(:fechaHasta, \'YYYY-MM-DD\')';
            binds.fechaDesde = fechaDesde;
            binds.fechaHasta = fechaHasta;
        } else if (tipo === 'ANIO' && anio) {
            whereClause = ' AND pc.ANIO = :anio';
            binds.anio = parseInt(anio);
        } else if (tipo === 'HISTORICO') {
            whereClause = ''; // Sin restricciones, trae toda la historia
        } else {
            // Por defecto: MES puro transaccional
            whereClause = ' AND pc.ANIO = :anio AND pc.MES = :mes';
            binds.anio = parseInt(anio);
            binds.mes = parseInt(mes);
        }

        connection = await getConnection();
        const result = await connection.execute(
            `SELECT pc.POLIZA_ID, pc.FECHA, pc.NUM_POLIZA, pc.TIPO_POLIZA, pc.SINOPSIS,
                    pd.DETALLE_ID, pd.CUENTA_ID, cc.NOMBRE AS NOMBRE_CUENTA, pd.DEBE, pd.HABER
             FROM POLIZAS_CABECERA pc
             JOIN POLIZAS_DETALLE pd ON pc.POLIZA_ID = pd.POLIZA_ID
             JOIN CATALOGO_CUENTAS cc ON pd.CUENTA_ID = cc.CUENTA_ID
             WHERE pc.ESTADO = 'AUTORIZADA' ${whereClause}
             ORDER BY pc.FECHA, pc.POLIZA_ID, pd.DETALLE_ID`,
            binds,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const partidas = result.rows.reduce((acc, row) => {
            const key = row.POLIZA_ID;
            if (!acc[key]) {
                acc[key] = {
                    POLIZA_ID: row.POLIZA_ID,
                    FECHA: row.FECHA,
                    NUM_POLIZA: row.NUM_POLIZA,
                    TIPO_POLIZA: row.TIPO_POLIZA,
                    SINOPSIS: row.SINOPSIS,
                    movimientos: [],
                    totalDebe: 0,
                    totalHaber: 0
                };
            }
            const debe = parseFloat(row.DEBE) || 0;
            const haber = parseFloat(row.HABER) || 0;
            acc[key].movimientos.push({
                DETALLE_ID: row.DETALLE_ID,
                CUENTA_ID: row.CUENTA_ID,
                NOMBRE_CUENTA: row.NOMBRE_CUENTA,
                DEBE: debe,
                HABER: haber
            });
            acc[key].totalDebe = Math.round((acc[key].totalDebe + debe) * 100) / 100;
            acc[key].totalHaber = Math.round((acc[key].totalHaber + haber) * 100) / 100;
            return acc;
        }, {});

        res.json(Object.values(partidas));
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});


// ─────────────────────────────────────────────
// 2. GET — Balance de Saldos (Filtrado por Periodo)
// ─────────────────────────────────────────────
router.get('/reportes/balance-saldos', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes, tipo, fechaDesde, fechaHasta } = req.query;
        if (!anio || !mes) return res.status(400).json({ message: 'Año y Mes obligatorios.' });

        const targetAnio = parseInt(anio);
        const targetMes = parseInt(mes);

        let filtroHistorial = '';
        const bindsHist = {};

        if (tipo === 'RANGO' && fechaDesde && fechaHasta) {
            filtroHistorial = 'AND TRUNC(pc.FECHA) BETWEEN TO_DATE(:fechaDesde, \'YYYY-MM-DD\') AND TO_DATE(:fechaHasta, \'YYYY-MM-DD\')';
            bindsHist.fechaDesde = fechaDesde;
            bindsHist.fechaHasta = fechaHasta;
        } else if (tipo === 'ANIO') {
            filtroHistorial = 'AND pc.ANIO = :anio';
            bindsHist.anio = targetAnio;
        } else if (tipo === 'HISTORICO') {
            filtroHistorial = '';
        } else {
            // MES (Acumulado clásico de toda la vida)
            filtroHistorial = 'AND (pc.ANIO < :anio OR (pc.ANIO = :anio AND pc.MES <= :mes))';
            bindsHist.anio = targetAnio;
            bindsHist.mes = targetMes;
        }

        connection = await getConnection();
        const sqlQuery = `
            SELECT cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.SUB_RUBRO, cc.TIPO_SALDO,
                NVL(mov_mes.SUMA_DEBE, 0) AS SUMA_DEBE, NVL(mov_mes.SUMA_HABER, 0) AS SUMA_HABER,
                CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(mov_hist.HIST_DEBE, 0) - NVL(mov_hist.HIST_HABER, 0)
                     ELSE NVL(mov_hist.HIST_HABER, 0) - NVL(mov_hist.HIST_DEBE, 0) END AS SALDO_FINAL
            FROM CATALOGO_CUENTAS cc
            LEFT JOIN (
                SELECT pd.CUENTA_ID, SUM(pd.DEBE) AS SUMA_DEBE, SUM(pd.HABER) AS SUMA_HABER
                FROM POLIZAS_DETALLE pd
                JOIN POLIZAS_CABECERA pc ON pd.POLIZA_ID = pc.POLIZA_ID
                WHERE pc.ANIO = :anio AND pc.MES = :mes AND pc.ESTADO = 'AUTORIZADA'
                GROUP BY pd.CUENTA_ID
            ) mov_mes ON cc.CUENTA_ID = mov_mes.CUENTA_ID
            LEFT JOIN (
                SELECT pd.CUENTA_ID, SUM(pd.DEBE) AS HIST_DEBE, SUM(pd.HABER) AS HIST_HABER
                FROM POLIZAS_DETALLE pd
                JOIN POLIZAS_CABECERA pc ON pd.POLIZA_ID = pc.POLIZA_ID
                WHERE pc.ESTADO = 'AUTORIZADA' ${filtroHistorial}
                GROUP BY pd.CUENTA_ID
            ) mov_hist ON cc.CUENTA_ID = mov_hist.CUENTA_ID
            WHERE cc.ESTADO = 'ACTIVO'
              AND (NVL(mov_mes.SUMA_DEBE, 0) > 0 OR NVL(mov_mes.SUMA_HABER, 0) > 0 OR 
                   ABS(CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(mov_hist.HIST_DEBE, 0) - NVL(mov_hist.HIST_HABER, 0)
                            ELSE NVL(mov_hist.HIST_HABER, 0) - NVL(mov_hist.HIST_DEBE, 0) END) > 0.01)
            ORDER BY cc.CUENTA_ID`;

        const baseBinds = { ...bindsHist };
        if (!baseBinds.anio && tipo !== 'HISTORICO') baseBinds.anio = targetAnio;
        if (!baseBinds.mes && tipo === 'MES') baseBinds.mes = targetMes;

        // Combinamos binds para inyección limpia de Oracle
        const finalBinds = { anio: targetAnio, mes: targetMes, ...baseBinds };

        const result = await connection.execute(sqlQuery, finalBinds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        let totalDebeMov = 0; let totalHaberMov = 0; let totalSaldoDeudor = 0; let totalSaldoAcreedor = 0;
        result.rows.forEach(r => {
            totalDebeMov += parseFloat(r.SUMA_DEBE) || 0;
            totalHaberMov += parseFloat(r.SUMA_HABER) || 0;
            const saldoFinal = parseFloat(r.SALDO_FINAL) || 0;
            if (r.TIPO_SALDO === 'DEUDOR') totalSaldoDeudor += saldoFinal;
            else totalSaldoAcreedor += saldoFinal;
        });

        res.json({
            cuentas: result.rows,
            totales: {
                totalDebe: Math.round(totalDebeMov * 100) / 100,
                totalHaber: Math.round(totalHaberMov * 100) / 100,
                totalSaldoDeudor: Math.round(totalSaldoDeudor * 100) / 100,
                totalSaldoAcreedor: Math.round(totalSaldoAcreedor * 100) / 100
            },
            cuadrado: Math.abs(totalSaldoDeudor - totalSaldoAcreedor) < 0.05
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error interno en Oracle." });
    } finally {
        if (connection) await connection.close();
    }
});

// ─────────────────────────────────────────────
// 3. GET — Estado de Resultados (Cálculo Inmediato de Utilidad)
// ─────────────────────────────────────────────
router.get('/reportes/estado-resultados', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes, tipo, fechaDesde, fechaHasta } = req.query;
        if (!anio || !mes) return res.status(400).json({ message: 'Año y Mes son obligatorios.' });

        let filtroResultados = '';
        const binds = {};

        if (tipo === 'RANGO' && fechaDesde && fechaHasta) {
            filtroResultados = 'AND TRUNC(pc.FECHA) BETWEEN TO_DATE(:fechaDesde, \'YYYY-MM-DD\') AND TO_DATE(:fechaHasta, \'YYYY-MM-DD\')';
            binds.fechaDesde = fechaDesde;
            binds.fechaHasta = fechaHasta;
        } else if (tipo === 'ANIO') {
            filtroResultados = 'AND pc.ANIO = :anio';
            binds.anio = parseInt(anio);
        } else if (tipo === 'HISTORICO') {
            filtroResultados = '';
        } else {
            // MES transaccional puro
            filtroResultados = 'AND pc.ANIO = :anio AND pc.MES = :mes';
            binds.anio = parseInt(anio);
            binds.mes = parseInt(mes);
        }

        connection = await getConnection();
        const result = await connection.execute(
            `SELECT cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.CLASIFICACION_HOJA, cc.SUB_RUBRO,
                CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                     ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END AS SALDO
            FROM CATALOGO_CUENTAS cc
            JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
            JOIN POLIZAS_CABECERA pc ON pd.POLIZA_ID = pc.POLIZA_ID
            WHERE cc.RUBRO IN ('PERDIDA', 'GANANCIA') AND pc.ESTADO = 'AUTORIZADA' ${filtroResultados}
            GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.CLASIFICACION_HOJA, cc.SUB_RUBRO, cc.TIPO_SALDO
            HAVING (CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                         ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END) != 0
            ORDER BY cc.RUBRO DESC, cc.CUENTA_ID`,
            binds,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        let ingresos = []; let costos = []; let gastos = [];
        let totalIngresos = 0; let totalCostos = 0; let totalGastos = 0;

        result.rows.forEach(row => {
            const saldo = parseFloat(row.SALDO) || 0;
            if (row.RUBRO === 'GANANCIA') { ingresos.push(row); totalIngresos += saldo; }
            else if (row.RUBRO === 'PERDIDA' && row.CLASIFICACION_HOJA === 'COSTO_VENTAS') { costos.push(row); totalCostos += saldo; }
            else { gastos.push(row); totalGastos += saldo; }
        });

        const utilidadBruta = totalIngresos - totalCostos;
        const utilidadNeta = utilidadBruta - totalGastos;

        res.json({
            ingresos, costos, gastos,
            totalIngresos: Math.round(totalIngresos * 100) / 100,
            totalCostos: Math.round(totalCostos * 100) / 100,
            utilidadBruta: Math.round(utilidadBruta * 100) / 100,
            totalGastos: Math.round(totalGastos * 100) / 100,
            utilidadNeta: Math.round(utilidadNeta * 100) / 100
        });
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});


// ─────────────────────────────────────────────
// 4. GET — Balance General (Agrupado con Parche de Patrimonio y Utilidad)
// ─────────────────────────────────────────────
router.get('/reportes/balance-general', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes, tipo, fechaDesde, fechaHasta } = req.query;
        if (!anio || !mes) return res.status(400).json({ message: 'Año y Mes son obligatorios.' });

        const targetAnio = parseInt(anio);
        const targetMes = parseInt(mes);

        let filtroBalance = '';
        let filtroUtilidad = '';
        const bindsBG = {};

        if (tipo === 'RANGO' && fechaDesde && fechaHasta) {
            filtroBalance = 'AND TRUNC(pc.FECHA) <= TO_DATE(:fechaHasta, \'YYYY-MM-DD\')';
            filtroUtilidad = 'AND TRUNC(pc.FECHA) BETWEEN TO_DATE(:fechaDesde, \'YYYY-MM-DD\') AND TO_DATE(:fechaHasta, \'YYYY-MM-DD\')';
            bindsBG.fechaDesde = fechaDesde;
            bindsBG.fechaHasta = fechaHasta;
        } else if (tipo === 'ANIO') {
            filtroBalance = 'AND pc.ANIO <= :anio';
            filtroUtilidad = 'AND pc.ANIO = :anio';
            bindsBG.anio = targetAnio;
        } else if (tipo === 'HISTORICO') {
            filtroBalance = '';
            filtroUtilidad = '';
        } else {
            // MES acumulado tradicional
            filtroBalance = 'AND (pc.ANIO < :anio OR (pc.ANIO = :anio AND pc.MES <= :mes))';
            filtroUtilidad = 'AND pc.ANIO = :anio AND pc.MES <= :mes';
            bindsBG.anio = targetAnio;
            bindsBG.mes = targetMes;
        }

        connection = await getConnection();

        const resultCuentas = await connection.execute(
            `SELECT cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.SUB_RUBRO,
                CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                     ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END AS SALDO
             FROM CATALOGO_CUENTAS cc
             JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
             JOIN POLIZAS_CABECERA pc ON pd.POLIZA_ID = pc.POLIZA_ID
             WHERE cc.RUBRO IN ('ACTIVO', 'PASIVO') AND pc.ESTADO = 'AUTORIZADA' ${filtroBalance}
             GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.SUB_RUBRO, cc.TIPO_SALDO
             HAVING (CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                          ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END) != 0
             ORDER BY cc.RUBRO, cc.CUENTA_ID`,
            bindsBG, { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const resultUtilidad = await connection.execute(
            `SELECT cc.RUBRO, NVL(SUM(pd.DEBE), 0) AS TOTAL_DEBE, NVL(SUM(pd.HABER), 0) AS TOTAL_HABER
             FROM CATALOGO_CUENTAS cc
             JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
             JOIN POLIZAS_CABECERA pc ON pd.POLIZA_ID = pc.POLIZA_ID
             WHERE cc.RUBRO IN ('PERDIDA', 'GANANCIA') AND pc.ESTADO = 'AUTORIZADA' ${filtroUtilidad}
             GROUP BY cc.RUBRO`,
            bindsBG, { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        let totalIngresos = 0; let totalGastos = 0;
        resultUtilidad.rows.forEach(r => {
            if (r.RUBRO === 'GANANCIA') totalIngresos += (parseFloat(r.TOTAL_HABER) - parseFloat(r.TOTAL_DEBE)) || 0;
            else if (r.RUBRO === 'PERDIDA') totalGastos += (parseFloat(r.TOTAL_DEBE) - parseFloat(r.TOTAL_HABER)) || 0;
        });
        const utilidadDelEjercicio = totalIngresos - totalGastos;

        let activos = []; let pasivos = []; let patrimonio = [];
        let totalActivo = 0; let totalPasivo = 0; let totalPatrimonio = 0;

        resultCuentas.rows.forEach(row => {
            const saldo = parseFloat(row.SALDO) || 0;
            if (row.RUBRO === 'ACTIVO') { activos.push(row); totalActivo += saldo; }
            else if (row.RUBRO === 'PASIVO' && row.SUB_RUBRO === 'PATRIMONIO') { patrimonio.push(row); totalPatrimonio += saldo; }
            else { pasivos.push(row); totalPasivo += saldo; }
        });

        patrimonio.push({ CUENTA_ID: '9999', NOMBRE: 'UTILIDAD NETAS DEL EJERCICIO', RUBRO: 'PASIVO', SUB_RUBRO: 'PATRIMONIO', SALDO: Math.round(utilidadDelEjercicio * 100) / 100 });
        totalPatrimonio += utilidadDelEjercicio;
        const totalPasivoPatrimonio = totalPasivo + totalPatrimonio;

        res.json({
            activos, pasivos, patrimonio,
            totalActivo: Math.round(totalActivo * 100) / 100,
            totalPasivo: Math.round(totalPasivo * 100) / 100,
            totalPatrimonio: Math.round(totalPatrimonio * 100) / 100,
            totalPasivoPatrimonio: Math.round(totalPasivoPatrimonio * 100) / 100,
            cuadrado: Math.abs(totalActivo - totalPasivoPatrimonio) < 0.05
        });
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;

