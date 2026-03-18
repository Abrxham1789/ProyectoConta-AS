const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - registrar log
router.post('/logs', async (req, res) => {
    let connection;
    try {
        const { USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            { USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID: REGISTRO_ID || null },
            { autoCommit: true }
        );

        res.json({ message: "Log registrado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los logs
router.get('/logs', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT l.*, u.USERNAME
             FROM LOGS_AUDITORIA l
             LEFT JOIN USUARIOS_CONTABLES u ON l.USER_ID = u.USER_ID
             ORDER BY l.FECHA_HORA DESC`,
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

// READ - obtener log por ID
router.get('/logs/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT l.*, u.USERNAME
             FROM LOGS_AUDITORIA l
             LEFT JOIN USUARIOS_CONTABLES u ON l.USER_ID = u.USER_ID
             WHERE l.LOG_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Log no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener logs por usuario
router.get('/logs/usuario/:userId', async (req, res) => {
    let connection;
    try {
        const userId = req.params.userId;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT l.*, u.USERNAME
             FROM LOGS_AUDITORIA l
             LEFT JOIN USUARIOS_CONTABLES u ON l.USER_ID = u.USER_ID
             WHERE l.USER_ID = :userId
             ORDER BY l.FECHA_HORA DESC`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar log
router.put('/logs/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE LOGS_AUDITORIA
             SET USER_ID = :USER_ID,
                 ACCION = :ACCION,
                 TABLA_AFECTADA = :TABLA_AFECTADA,
                 REGISTRO_ID = :REGISTRO_ID
             WHERE LOG_ID = :id`,
            { USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID: REGISTRO_ID || null, id },
            { autoCommit: true }
        );

        res.json({ message: "Log actualizado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar log
router.delete('/logs/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        await connection.execute(
            `DELETE FROM LOGS_AUDITORIA WHERE LOG_ID = :id`,
            { id },
            { autoCommit: true }
        );

        res.json({ message: "Log eliminado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;