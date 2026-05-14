const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// Middleware interno para restringir accesos exclusivamente a administradores
const exigirAdmin = (req, res, next) => {
    if (req.usuario?.ROL !== 'ADMIN') {
        return res.status(403).json({ message: "Acceso denegado. Se requieren privilegios de administrador." });
    }
    next();
};

// CREATE - registrar log (Disponible para el sistema interno)
router.post('/logs', verificarToken, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error interno al registrar la bitácora" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los logs (Solo ADMIN)
router.get('/logs', verificarToken, exigirAdmin, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error al obtener el historial de logs" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener log por ID (Solo ADMIN)
router.get('/logs/:id', verificarToken, exigirAdmin, async (req, res) => {
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

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al buscar el registro de log" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener logs por usuario (Solo ADMIN)
router.get('/logs/usuario/:userId', verificarToken, exigirAdmin, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error al filtrar logs por usuario" });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
