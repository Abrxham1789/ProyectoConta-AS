const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// GET - Libro Diario
router.get('/reportes/libro-diario', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT 
                pc.POLIZA_ID,
                pc.FECHA,
                pc.NUM_POLIZA,
                pc.TIPO_POLIZA,
                pc.SINOPSIS,
                pd.DETALLE_ID,
                pd.CUENTA_ID,
                cc.NOMBRE AS NOMBRE_CUENTA,
                pd.DEBE,
                pd.HABER
             FROM POLIZAS_CABECERA pc
             JOIN POLIZAS_DETALLE pd ON pc.POLIZA_ID = pd.POLIZA_ID
             JOIN CATALOGO_CUENTAS cc ON pd.CUENTA_ID = cc.CUENTA_ID
             ORDER BY pc.FECHA, pc.POLIZA_ID, pd.DETALLE_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// GET - Balance General
router.get('/reportes/balance-general', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT 
                cc.CUENTA_ID,
                cc.NOMBRE,
                cc.RUBRO,
                cc.SUB_RUBRO,
                cc.TIPO_SALDO,
                NVL(SUM(pd.DEBE), 0) AS TOTAL_DEBE,
                NVL(SUM(pd.HABER), 0) AS TOTAL_HABER,
                CASE 
                    WHEN cc.TIPO_SALDO = 'DEUDOR' 
                    THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                    ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0)
                END AS SALDO
             FROM CATALOGO_CUENTAS cc
             LEFT JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
             WHERE cc.RUBRO IN ('ACTIVO', 'PASIVO')
             GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.SUB_RUBRO, cc.TIPO_SALDO
             ORDER BY cc.RUBRO, cc.CUENTA_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// GET - Estado de Resultados
router.get('/reportes/estado-resultados', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT 
                cc.CUENTA_ID,
                cc.NOMBRE,
                cc.RUBRO,
                cc.CLASIFICACION_HOJA,
                cc.TIPO_SALDO,
                NVL(SUM(pd.DEBE), 0) AS TOTAL_DEBE,
                NVL(SUM(pd.HABER), 0) AS TOTAL_HABER,
                CASE 
                    WHEN cc.TIPO_SALDO = 'DEUDOR' 
                    THEN NVL(SUM(pd.DEBE), 0) - NVL(SUM(pd.HABER), 0)
                    ELSE NVL(SUM(pd.HABER), 0) - NVL(SUM(pd.DEBE), 0)
                END AS SALDO
            FROM CATALOGO_CUENTAS cc
            LEFT JOIN POLIZAS_DETALLE pd ON cc.CUENTA_ID = pd.CUENTA_ID
            WHERE cc.RUBRO IN ('PERDIDA', 'GANANCIA')
            GROUP BY cc.CUENTA_ID, cc.NOMBRE, cc.RUBRO, cc.CLASIFICACION_HOJA, cc.TIPO_SALDO
            ORDER BY cc.RUBRO, cc.CUENTA_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;