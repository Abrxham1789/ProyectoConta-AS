const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - crear póliza cabecera
router.post('/polizas-cabecera', async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO POLIZAS_CABECERA (ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS)
             VALUES (:ANIO, :MES, :NUM_POLIZA, TO_DATE(:FECHA, 'YYYY-MM-DD'), :TIPO_POLIZA, :ESTADO, :SINOPSIS)`,
            {
                ANIO,
                MES,
                NUM_POLIZA,
                FECHA: FECHA || null,
                TIPO_POLIZA,
                ESTADO: ESTADO || 'BORRADOR',
                SINOPSIS: SINOPSIS || null
            },
            { autoCommit: true }
        );

        res.json({ message: "Póliza cabecera creada correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todas las pólizas cabecera
router.get('/polizas-cabecera', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM POLIZAS_CABECERA ORDER BY POLIZA_ID DESC`,
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

// READ - obtener una póliza por ID
router.get('/polizas-cabecera/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM POLIZAS_CABECERA WHERE POLIZA_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Póliza no encontrada" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar póliza cabecera
router.put('/polizas-cabecera/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE POLIZAS_CABECERA
             SET ANIO = :ANIO,
                 MES = :MES,
                 NUM_POLIZA = :NUM_POLIZA,
                 FECHA = TO_DATE(:FECHA, 'YYYY-MM-DD'),
                 TIPO_POLIZA = :TIPO_POLIZA,
                 ESTADO = :ESTADO,
                 SINOPSIS = :SINOPSIS
             WHERE POLIZA_ID = :id`,
            { ANIO, MES, NUM_POLIZA, FECHA: FECHA || null, TIPO_POLIZA, ESTADO, SINOPSIS: SINOPSIS || null, id },
            { autoCommit: true }
        );

        res.json({ message: "Póliza actualizada correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar póliza cabecera
router.delete('/polizas-cabecera/:id', async (req, res) => {
    let connection;
    try {
        const id = req.params.id;

        connection = await getConnection();

        await connection.execute(
            `DELETE FROM POLIZAS_CABECERA WHERE POLIZA_ID = :id`,
            { id },
            { autoCommit: true }
        );

        res.json({ message: "Póliza eliminada correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;