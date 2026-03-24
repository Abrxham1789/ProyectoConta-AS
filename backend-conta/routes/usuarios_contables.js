const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - crear usuario
router.post('/usuarios', async (req, res) => {
    let connection;
    try {
        const { USER_ID, USERNAME, PASSWORD_HASH, ROL } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO USUARIOS_CONTABLES (USER_ID, USERNAME, PASSWORD_HASH, ROL)
            VALUES (:USER_ID, :USERNAME, :PASSWORD_HASH, :ROL)`,
            { USER_ID, USERNAME, PASSWORD_HASH, ROL },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.body.LOGGED_USER_ID || null,
            ACCION: 'INSERT',
            TABLA_AFECTADA: 'USUARIOS_CONTABLES',
            REGISTRO_ID: req.body.USER_ID || null
            },
            { autoCommit: true }
        );

        res.json({ message: "Usuario creado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los usuarios (sin password)
router.get('/usuarios', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT USER_ID, USERNAME, ROL FROM USUARIOS_CONTABLES ORDER BY USER_ID`,
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

// READ - obtener usuario por ID
router.get('/usuarios/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT USER_ID, USERNAME, ROL FROM USUARIOS_CONTABLES WHERE USER_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar usuario
router.put('/usuarios/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { USERNAME, PASSWORD_HASH, ROL } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE USUARIOS_CONTABLES
            SET USERNAME = :USERNAME,
            PASSWORD_HASH = :PASSWORD_HASH,
            ROL = :ROL
            WHERE USER_ID = :id`,
            { USERNAME, PASSWORD_HASH, ROL, id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.body.LOGGED_USER_ID || null,
            ACCION: 'UPDATE',
            TABLA_AFECTADA: 'USUARIOS_CONTABLES',
            REGISTRO_ID: parseInt(id)
            },
            { autoCommit: true }
            );

        res.json({ message: "Usuario actualizado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar usuario
router.delete('/usuarios/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        await connection.execute(
            `DELETE FROM USUARIOS_CONTABLES WHERE USER_ID = :id`,
            { id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.body.LOGGED_USER_ID || null,
            ACCION: 'DELETE',
            TABLA_AFECTADA: 'USUARIOS_CONTABLES',
            REGISTRO_ID: parseInt(id)
            },
            { autoCommit: true }
        );

        res.json({ message: "Usuario eliminado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// LOGIN - verificar credenciales
router.post('/usuarios/login', async (req, res) => {
    let connection;
    try {
        const { USERNAME, PASSWORD_HASH } = req.body;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT USER_ID, USERNAME, ROL FROM USUARIOS_CONTABLES
            WHERE USERNAME = :USERNAME AND PASSWORD_HASH = :PASSWORD_HASH`,
            { USERNAME, PASSWORD_HASH },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales incorrectas' });
        }

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;