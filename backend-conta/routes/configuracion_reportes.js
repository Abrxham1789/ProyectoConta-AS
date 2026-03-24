const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - crear configuración de reporte
router.post('/configuracion-reportes', async (req, res) => {
    let connection;
    try {
        const { CONFIG_ID, NOMBRE_REPORTE, SECCION, CUENTA_ID, ORDEN, OPERACION } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO CONFIGURACION_REPORTES (CONFIG_ID, NOMBRE_REPORTE, SECCION, CUENTA_ID, ORDEN, OPERACION)
             VALUES (:CONFIG_ID, :NOMBRE_REPORTE, :SECCION, :CUENTA_ID, :ORDEN, :OPERACION)`,
            { CONFIG_ID, NOMBRE_REPORTE, SECCION, CUENTA_ID, ORDEN, OPERACION },
            { autoCommit: true }
        );

        res.json({ message: "Configuración de reporte creada correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todas las configuraciones
router.get('/configuracion-reportes', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM CONFIGURACION_REPORTES ORDER BY NOMBRE_REPORTE, ORDEN`,
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

// READ - obtener configuración por ID
router.get('/configuracion-reportes/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM CONFIGURACION_REPORTES WHERE CONFIG_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Configuración no encontrada" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar configuración
router.put('/configuracion-reportes/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { NOMBRE_REPORTE, SECCION, CUENTA_ID, ORDEN, OPERACION } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE CONFIGURACION_REPORTES
            SET NOMBRE_REPORTE = :NOMBRE_REPORTE,
            SECCION = :SECCION,
            CUENTA_ID = :CUENTA_ID,
            ORDEN = :ORDEN,
            OPERACION = :OPERACION
            WHERE CONFIG_ID = :id`,
            { NOMBRE_REPORTE, SECCION, CUENTA_ID, ORDEN, OPERACION, id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.body.LOGGED_USER_ID || null,
            ACCION: 'UPDATE',
            TABLA_AFECTADA: 'CONFIGURACION_REPORTES',
            REGISTRO_ID: req.body.CONFIG_ID || null
            },
            { autoCommit: true }
        );

        res.json({ message: "Configuración actualizada correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar configuración
router.delete('/configuracion-reportes/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        await connection.execute(
            `DELETE FROM CONFIGURACION_REPORTES WHERE CONFIG_ID = :id`,
            { id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.body.LOGGED_USER_ID || null,
            ACCION: 'DELETE',
            TABLA_AFECTADA: 'CONFIGURACION_REPORTES',
            REGISTRO_ID: req.body.CONFIG_ID || null
            },
            { autoCommit: true }
        );

        res.json({ message: "Configuración eliminada correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;