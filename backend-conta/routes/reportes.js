const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// Helper interno seguro para manejo de excepciones
const handleError = (res, err) => {
    console.error('[Reportes Error]', err); 
    res.status(500).json({ message: 'Error interno al procesar el reporte solicitado.' });
};

// GET - Libro Diario (Protegido con token + binds estructurados)
router.get('/reportes/libro-diario', verificarToken, async (req, res) => {
    let connection;
    try {
        const { fechaDesde, fechaHasta } = req.query;
        let whereClause = '';
        const binds = {};

        if (fechaDesde) {
            whereClause += ' AND pc.FECHA >= :fechaDesde';
            binds.fechaDesde = fechaDesde;
        }
        if (fechaHasta) {
            whereClause += ' AND pc.FECHA <= :fechaHasta';
            binds.fechaHasta = fechaHasta;
        }

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT pc.POLIZA_ID, pc.FECHA, pc.NUM_POLIZA, pc.TIPO_POLIZA, pc.SINOPSIS,
                    pd.DETALLE_ID, pd.CUENTA_ID, cc.NOMBRE AS NOMBRE_CUENTA, pd.DEBE, pd.HABER
             FROM POLIZAS_CABECERA pc
             JOIN POLIZAS_DETALLE pd ON pc.POLIZA_ID = pd.POLIZA_ID
             JOIN CATALOGO_CUENTAS cc ON pd.CUENTA_ID = cc.CUENTA_ID
             WHERE 1=1 ${whereClause}
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
            acc[key].totalDebe += debe;
            acc[key].totalHaber += haber;
            return acc;
        }, {});

        res.json(Object.values(partidas));
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});

// GET - Balance General (Protegido con token)
router.get('/reportes/balance-general', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.SUB_RUBRO, cc.TIPO_SALDO,
                NVL(SUM(pd.DEBE), 0)  AS TOTAL_DEBE, NVL(SUM(pd.HABER), 0) AS TOTAL_HABER,
                CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                     ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END AS SALDO
             FROM CATALOGO_CUENTAS cc
             LEFT JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
             WHERE cc.RUBRO IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')
             GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.SUB_RUBRO, cc.TIPO_SALDO
             HAVING (CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                          ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END) != 0
             ORDER BY cc.RUBRO, cc.SUB_RUBRO, cc.CUENTA_ID`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});

// GET - Estado de Resultados (Protegido con token)
router.get('/reportes/estado-resultados', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.CLASIFICACION_HOJA, cc.SUB_RUBRO, cc.TIPO_SALDO,
                NVL(SUM(pd.DEBE), 0)  AS TOTAL_DEBE, NVL(SUM(pd.HABER), 0) AS TOTAL_HABER,
                CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                     ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END AS SALDO
            FROM CATALOGO_CUENTAS cc
            LEFT JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
            WHERE cc.RUBRO IN ('PERDIDA', 'GANANCIA', 'COSTO')
            GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.CLASIFICACION_HOJA, cc.SUB_RUBRO, cc.TIPO_SALDO
            HAVING (CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                         ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END) != 0
            ORDER BY cc.RUBRO, cc.CLASIFICACION_HOJA, cc.CUENTA_ID`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});

// GET - Balance de Saldos / Trial Balance (Corregido y Protegido)
router.get('/reportes/balance-saldos', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.TIPO_SALDO,
                NVL(SUM(pd.DEBE), 0)  AS SUMA_DEBE, NVL(SUM(pd.HABER), 0) AS SUMA_HABER,
                CASE WHEN cc.TIPO_SALDO = 'DEUDOR' THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                     ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0) END AS SALDO_FINAL
             FROM CATALOGO_CUENTAS cc
             LEFT JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
             WHERE cc.ESTADO = 'ACTIVO'
             GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.TIPO_SALDO
             ORDER BY cc.CUENTA_ID`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Se completó la función de reducción que estaba mocha e inconclusa
        const balanceGeneral = result.rows.reduce(
            (acc, r) => {
                acc.totalDebe += parseFloat(r.SUMA_DEBE) || 0;
                acc.totalHaber += parseFloat(r.SUMA_HABER) || 0;
                return acc;
            },
            { totalDebe: 0, totalHaber: 0 }
        );

        res.json({
            cuentas: result.rows,
            totalesGlobales: balanceGeneral
        });
    } catch (err) {
        handleError(res, err);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
