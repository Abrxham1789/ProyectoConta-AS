const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// CREATE - crear detalle de póliza
router.post('/polizas-detalle', verificarToken, async (req, res) => {
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

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'INSERT',
                TABLA_AFECTADA: 'POLIZAS_DETALLE',
                REGISTRO_ID: `${POLIZA_ID}-${CUENTA_ID}`
            },
            { autoCommit: true }
        );

        res.json({ message: "Detalle de póliza creado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error interno al insertar el detalle de póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los detalles
router.get('/polizas-detalle', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT pd.*, cc.NOMBRE AS NOMBRE_CUENTA
            FROM POLIZAS_DETALLE pd
            JOIN CATALOGO_CUENTAS cc ON pd.CUENTA_ID = cc.CUENTA_ID
            ORDER BY pd.DETALLE_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener el catálogo de detalles" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener detalles por POLIZA_ID
router.get('/polizas-detalle/poliza/:polizaId', verificarToken, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error al obtener los detalles de la póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener un detalle por ID
router.get('/polizas-detalle/:id', verificarToken, async (req, res) => {
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

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al buscar el detalle especificado" });
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar detalle
router.put('/polizas-detalle/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { POLIZA_ID, CUENTA_ID, DEBE, HABER } = req.body;
        connection = await getConnection();

        await connection.execute(
            `UPDATE POLIZAS_DETALLE
            SET POLIZA_ID = :POLIZA_ID, CUENTA_ID = :CUENTA_ID, DEBE = :DEBE, HABER = :HABER
            WHERE DETALLE_ID = :id`,
            { POLIZA_ID, CUENTA_ID, DEBE: DEBE || 0, HABER: HABER || 0, id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'UPDATE',
                TABLA_AFECTADA: 'POLIZAS_DETALLE',
                REGISTRO_ID: id
            },
            { autoCommit: true }
        );

        res.json({ message: "Detalle actualizado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al actualizar el detalle de póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar detalle
router.delete('/polizas-detalle/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        connection = await getConnection();

        await connection.execute(
            `DELETE FROM POLIZAS_DETALLE WHERE DETALLE_ID = :id`,
            { id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'DELETE',
                TABLA_AFECTADA: 'POLIZAS_DETALLE',
                REGISTRO_ID: id
            },
            { autoCommit: true }
        );        

        res.json({ message: "Detalle eliminado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al eliminar el detalle" });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
