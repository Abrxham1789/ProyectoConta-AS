const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// IMPORTANTE: Importa aquí tu middleware de verificación de tokens JWT
// Si ya lo creaste, cambia la ruta de abajo por la ubicación de tu archivo.
const verificarToken = require('../middlewares/auth'); 

// CREATE - crear una cuenta (Ruta protegida con verificarToken)
router.post('/cuentas', verificarToken, async (req, res) => {
    let connection;
    try {
        const {
            CUENTA_ID,
            NOMBRE,
            TIPO_SALDO,
            CLASIFICACION_HOJA,
            RUBRO,
            SUB_RUBRO,
            ESTADO
        } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO CATALOGO_CUENTAS
            (CUENTA_ID, NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO)
            VALUES
            (:CUENTA_ID, :NOMBRE, :TIPO_SALDO, :CLASIFICACION_HOJA, :RUBRO, :SUB_RUBRO, :ESTADO)`,
            { CUENTA_ID, NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO },
            { autoCommit: true }
        );

        // El ID del usuario ahora se extrae de forma segura desde el Token verificado (req.usuario)
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null, 
                ACCION: 'INSERT',
                TABLA_AFECTADA: 'CATALOGO_CUENTAS',
                REGISTRO_ID: CUENTA_ID || null
            },
            { autoCommit: true }
        );

        res.json({ message: "Cuenta creada correctamente" });

    } catch (err) {
        console.error(err); // Mantén el log en tu consola para desarrollo
        res.status(500).json({ message: "Error interno del servidor al crear la cuenta" }); // Mensaje genérico seguro
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todas las cuentas (Ruta protegida con verificarToken)
router.get('/cuentas', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM CATALOGO_CUENTAS`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener el catálogo de cuentas" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener una cuenta por ID (Ruta protegida con verificarToken)
router.get('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM CATALOGO_CUENTAS WHERE CUENTA_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Cuenta no encontrada" });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al buscar la cuenta" });
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar cuenta (Ruta protegida con verificarToken)
router.put('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE CATALOGO_CUENTAS
            SET NOMBRE = :NOMBRE, TIPO_SALDO = :TIPO_SALDO, CLASIFICACION_HOJA = :CLASIFICACION_HOJA,
                RUBRO = :RUBRO, SUB_RUBRO = :SUB_RUBRO, ESTADO = :ESTADO
            WHERE CUENTA_ID = :id`,
            { NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO, id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'UPDATE',
                TABLA_AFECTADA: 'CATALOGO_CUENTAS',
                REGISTRO_ID: id
            },
            { autoCommit: true }
        );

        res.json({ message: "Cuenta actualizada correctamente" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al actualizar la cuenta" });
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar cuenta (Ruta protegida con verificarToken)
router.delete('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        connection = await getConnection();

        await connection.execute(
            `DELETE FROM CATALOGO_CUENTAS WHERE CUENTA_ID = :id`,
            { id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'DELETE',
                TABLA_AFECTADA: 'CATALOGO_CUENTAS',
                REGISTRO_ID: id
            },
            { autoCommit: true }
        );

        res.json({ message: "Cuenta eliminada correctamente" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al eliminar la cuenta" });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
