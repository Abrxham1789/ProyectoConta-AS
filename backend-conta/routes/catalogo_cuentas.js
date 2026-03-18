const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - crear una cuenta
router.post('/cuentas', async (req, res) => {

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

        {
        CUENTA_ID,
        NOMBRE,
        TIPO_SALDO,
        CLASIFICACION_HOJA,
        RUBRO,
        SUB_RUBRO,
        ESTADO
        },

        { autoCommit: true }
    );

    res.json({ message: "Cuenta creada correctamente" });

    } catch (err) {
        res.status(500).send(err.message);
    } finally {
    if (connection) await connection.close();
    }
});


// READ - obtener todas las cuentas
router.get('/cuentas', async (req, res) => {
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
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener una cuenta por ID
router.get('/cuentas/:id', async (req, res) => {
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
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});


// UPDATE - actualizar cuenta
router.put('/cuentas/:id', async (req, res) => {
    let connection;
    try {

    const id = req.params.id;

    const {
        NOMBRE,
        TIPO_SALDO,
        CLASIFICACION_HOJA,
        RUBRO,
        SUB_RUBRO,
        ESTADO
    } = req.body;

    connection = await getConnection();

    await connection.execute(
        `UPDATE CATALOGO_CUENTAS
        SET
        NOMBRE = :NOMBRE,
        TIPO_SALDO = :TIPO_SALDO,
        CLASIFICACION_HOJA = :CLASIFICACION_HOJA,
        RUBRO = :RUBRO,
        SUB_RUBRO = :SUB_RUBRO,
        ESTADO = :ESTADO
        WHERE CUENTA_ID = :id`,

        {
        NOMBRE,
        TIPO_SALDO,
        CLASIFICACION_HOJA,
        RUBRO,
        SUB_RUBRO,
        ESTADO,
        id
        },

        { autoCommit: true }
    );

    res.json({ message: "Cuenta actualizada correctamente" });

    } catch (err) {
    res.status(500).send(err.message);
    } finally {
    if (connection) await connection.close();
    }
});


// DELETE - eliminar cuenta
router.delete('/cuentas/:id', async (req, res) => {
    let connection;
    try {

    const id = req.params.id;

    connection = await getConnection();

    await connection.execute(
        `DELETE FROM CATALOGO_CUENTAS
        WHERE CUENTA_ID = :id`,
        { id },
        { autoCommit: true }
    );

    res.json({ message: "Cuenta eliminada correctamente" });

    } catch (err) {
    res.status(500).send(err.message);
    } finally {
    if (connection) await connection.close();
    }
});

module.exports = router;