const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// CREATE - insertar saldo en hoja de trabajo
router.post('/hoja-trabajo', verificarToken, async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, CUENTA_ID, SALDO_DEUDOR, SALDO_ACREEDOR, AJUSTE_DEBE, AJUSTE_HABER } = req.body;
        connection = await getConnection();

        await connection.execute(
            `INSERT INTO HOJA_TRABAJO_SALDOS
            (ANIO, MES, CUENTA_ID, SALDO_DEUDOR, SALDO_ACREEDOR, AJUSTE_DEBE, AJUSTE_HABER)
            VALUES (:ANIO, :MES, :CUENTA_ID, :SALDO_DEUDOR, :SALDO_ACREEDOR, :AJUSTE_DEBE, :AJUSTE_HABER)`,
            {
                ANIO, MES, CUENTA_ID,
                SALDO_DEUDOR: SALDO_DEUDOR || 0,
                SALDO_ACREEDOR: SALDO_ACREEDOR || 0,
                AJUSTE_DEBE: AJUSTE_DEBE || 0,
                AJUSTE_HABER: AJUSTE_HABER || 0
            },
            { autoCommit: true }
        );

        // Se corrigió REGISTRO_ID para almacenar la combinación única afectada
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'INSERT',
                TABLA_AFECTADA: 'HOJA_TRABAJO_SALDOS',
                REGISTRO_ID: `${ANIO}-${MES}-${CUENTA_ID}`
            },
            { autoCommit: true }
        );

        res.json({ message: "Saldo de hoja de trabajo creado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error interno al insertar saldo en la hoja de trabajo" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los saldos
router.get('/hoja-trabajo', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT h.*, c.NOMBRE AS NOMBRE_CUENTA
            FROM HOJA_TRABAJO_SALDOS h
            JOIN CATALOGO_CUENTAS c ON h.CUENTA_ID = c.CUENTA_ID
            ORDER BY h.ANIO DESC, h.MES DESC, h.CUENTA_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener los saldos de la hoja de trabajo" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener saldos por periodo
router.get('/hoja-trabajo/:anio/:mes', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes } = req.params;
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT h.*, c.NOMBRE AS NOMBRE_CUENTA
            FROM HOJA_TRABAJO_SALDOS h
            JOIN CATALOGO_CUENTAS c ON h.CUENTA_ID = c.CUENTA_ID
            WHERE h.ANIO = :anio AND h.MES = :mes
            ORDER BY h.CUENTA_ID`,
            { anio, mes },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener los saldos del periodo solicitado" });
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar saldo
router.put('/hoja-trabajo/:anio/:mes/:cuentaId', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes, cuentaId } = req.params;
        const { SALDO_DEUDOR, SALDO_ACREEDOR, AJUSTE_DEBE, AJUSTE_HABER } = req.body;
        connection = await getConnection();

        await connection.execute(
            `UPDATE HOJA_TRABAJO_SALDOS
            SET SALDO_DEUDOR = :SALDO_DEUDOR, SALDO_ACREEDOR = :SALDO_ACREEDOR,
                AJUSTE_DEBE = :AJUSTE_DEBE, AJUSTE_HABER = :AJUSTE_HABER
            WHERE ANIO = :anio AND MES = :mes AND CUENTA_ID = :cuentaId`,
            {
                SALDO_DEUDOR: SALDO_DEUDOR || 0,
                SALDO_ACREEDOR: SALDO_ACREEDOR || 0,
                AJUSTE_DEBE: AJUSTE_DEBE || 0,
                AJUSTE_HABER: AJUSTE_HABER || 0,
                anio, mes, cuentaId
            },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'UPDATE',
                TABLA_AFECTADA: 'HOJA_TRABAJO_SALDOS',
                REGISTRO_ID: `${anio}-${mes}-${cuentaId}`
            },
            { autoCommit: true }
        );

        res.json({ message: "Saldo actualizado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al actualizar el saldo" });
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar saldo
router.delete('/hoja-trabajo/:anio/:mes/:cuentaId', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes, cuentaId } = req.params;
        connection = await getConnection();

        await connection.execute(
            `DELETE FROM HOJA_TRABAJO_SALDOS
            WHERE ANIO = :anio AND MES = :mes AND CUENTA_ID = :cuentaId`,
            { anio, mes, cuentaId },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'DELETE',
                TABLA_AFECTADA: 'HOJA_TRABAJO_SALDOS',
                REGISTRO_ID: `${anio}-${mes}-${cuentaId}`
            },
            { autoCommit: true }
        );

        res.json({ message: "Saldo eliminado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al eliminar el saldo" });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
