const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');

// CREATE - crear periodo de cierre
router.post('/periodos', async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, ESTADO_CIERRE, FECHA_CIERRE } = req.body;

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO PERIODOS_CIERRE (ANIO, MES, ESTADO_CIERRE, FECHA_CIERRE)
             VALUES (:ANIO, :MES, :ESTADO_CIERRE, TO_DATE(:FECHA_CIERRE, 'YYYY-MM-DD'))`,
            { ANIO, MES, ESTADO_CIERRE: ESTADO_CIERRE || 'ABIERTO', FECHA_CIERRE: FECHA_CIERRE || null },
            { autoCommit: true }
        );

        res.json({ message: "Periodo de cierre creado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todos los periodos
router.get('/periodos', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM PERIODOS_CIERRE ORDER BY ANIO DESC, MES DESC`,
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

// READ - obtener un periodo por ANIO y MES
router.get('/periodos/:anio/:mes', async (req, res) => {
    let connection;
    try {
        const { anio, mes } = req.params;

        connection = await getConnection();

        const result = await connection.execute(
            `SELECT * FROM PERIODOS_CIERRE WHERE ANIO = :anio AND MES = :mes`,
            { anio, mes },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Periodo no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar periodo
router.put('/periodos/:anio/:mes', async (req, res) => {
    let connection;
    try {
        const { anio, mes } = req.params;
        const { ESTADO_CIERRE, FECHA_CIERRE } = req.body;

        connection = await getConnection();

        await connection.execute(
            `UPDATE PERIODOS_CIERRE
             SET ESTADO_CIERRE = :ESTADO_CIERRE,
                 FECHA_CIERRE = TO_DATE(:FECHA_CIERRE, 'YYYY-MM-DD')
             WHERE ANIO = :anio AND MES = :mes`,
            { ESTADO_CIERRE, FECHA_CIERRE: FECHA_CIERRE || null, anio, mes },
            { autoCommit: true }
        );

        res.json({ message: "Periodo actualizado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar periodo
router.delete('/periodos/:anio/:mes', async (req, res) => {
    let connection;
    try {
        const { anio, mes } = req.params;

        connection = await getConnection();

        await connection.execute(
            `DELETE FROM PERIODOS_CIERRE WHERE ANIO = :anio AND MES = :mes`,
            { anio, mes },
            { autoCommit: true }
        );

        res.json({ message: "Periodo eliminado correctamente" });
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;