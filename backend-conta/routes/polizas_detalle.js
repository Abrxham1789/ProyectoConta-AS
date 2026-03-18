const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - crear detalle de póliza
router.post('/polizas-detalle', async (req, res) => {
    let connection;
    try {
        const { POLIZA_ID, CUENTA_ID, DEBE, HABER } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO POLIZAS_DETALLE (POLIZA_ID, CUENTA_ID, DEBE, HABER)
             VALUES (:POLIZA_ID, :CUENTA_ID, :DEBE, :HABER)`,
            { POLIZA_ID, CUENTA_ID, DEBE: DEBE || 0, HABER: HABER || 0 },
            { autoCommit: true }
        );

        res.json({ message: "Detalle de póliza creado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los detalles
router.get('/polizas-detalle', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM POLIZAS_DETALLE ORDER BY DETALLE_ID`,
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

// READ - obtener detalles por POLIZA_ID
router.get('/polizas-detalle/poliza/:polizaId', async (req, res) => {
    let connection;
    try {
        const polizaId = req.params.polizaId;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT pd.*, cc.NOMBRE AS NOMBRE_CUENTA
             FROM POLIZAS_DETALLE pd
             JOIN CATALOGO_CUENTAS cc ON pd.CUENTA_ID = cc.CUENTA_ID
             WHERE pd.POLIZA_ID = :polizaId
             ORDER BY pd.DETALLE_ID`,
            { polizaId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener un detalle por ID
router.get('/polizas-detalle/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT pd.*, cc.NOMBRE AS NOMBRE_CUENTA
             FROM POLIZAS_DETALLE pd
             JOIN CATALOGO_CUENTAS cc ON pd.CUENTA_ID = cc.CUENTA_ID
             WHERE pd.DETALLE_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Detalle no encontrado" });
        }

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar detalle
router.put('/polizas-detalle/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { POLIZA_ID, CUENTA_ID, DEBE, HABER } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE POLIZAS_DETALLE
             SET POLIZA_ID = :POLIZA_ID,
                 CUENTA_ID = :CUENTA_ID,
                 DEBE = :DEBE,
                 HABER = :HABER
             WHERE DETALLE_ID = :id`,
            { POLIZA_ID, CUENTA_ID, DEBE: DEBE || 0, HABER: HABER || 0, id },
            { autoCommit: true }
        );

        res.json({ message: "Detalle actualizado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar detalle
router.delete('/polizas-detalle/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        await connection.execute(
            `DELETE FROM POLIZAS_DETALLE WHERE DETALLE_ID = :id`,
            { id },
            { autoCommit: true }
        );

        res.json({ message: "Detalle eliminado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;