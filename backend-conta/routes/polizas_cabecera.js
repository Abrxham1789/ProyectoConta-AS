const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// CREATE - crear póliza cabecera
router.post('/polizas-cabecera', verificarToken, async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS } = req.body;
        connection = await getConnection();

        await connection.execute(
            `INSERT INTO POLIZAS_CABECERA (ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS)
            VALUES (:ANIO, :MES, :NUM_POLIZA, TO_DATE(:FECHA, 'YYYY-MM-DD'), :TIPO_POLIZA, :ESTADO, :SINOPSIS)`,
            { ANIO, MES, NUM_POLIZA, FECHA: FECHA || null, TIPO_POLIZA, ESTADO: ESTADO || 'BORRADOR', SINOPSIS: SINOPSIS || null },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'INSERT',
                TABLA_AFECTADA: 'POLIZAS_CABECERA',
                REGISTRO_ID: `${ANIO}-${MES}-${NUM_POLIZA}`
            },
            { autoCommit: true }
        );

        res.json({ message: "Póliza cabecera creada correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error interno al crear la cabecera de la póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener todas las pólizas cabecera
router.get('/polizas-cabecera', verificarToken, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error al obtener el listado de pólizas" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener una póliza por ID
router.get('/polizas-cabecera/:id', verificarToken, async (req, res) => {
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

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al buscar la póliza especificada" });
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar póliza cabecera
router.put('/polizas-cabecera/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS } = req.body;
        connection = await getConnection();

        await connection.execute(
            `UPDATE POLIZAS_CABECERA
            SET ANIO = :ANIO, MES = :MES, NUM_POLIZA = :NUM_POLIZA, FECHA = TO_DATE(:FECHA, 'YYYY-MM-DD'),
                TIPO_POLIZA = :TIPO_POLIZA, ESTADO = :ESTADO, SINOPSIS = :SINOPSIS
            WHERE POLIZA_ID = :id`,
            { ANIO, MES, NUM_POLIZA, FECHA: FECHA || null, TIPO_POLIZA, ESTADO, SINOPSIS: SINOPSIS || null, id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'UPDATE',
                TABLA_AFECTADA: 'POLIZAS_CABECERA',
                REGISTRO_ID: id
            },
            { autoCommit: true }
        );

        res.json({ message: "Póliza actualizada correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al actualizar la cabecera de la póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar póliza cabecera
router.delete('/polizas-cabecera/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        connection = await getConnection();

        await connection.execute(
            `DELETE FROM POLIZAS_CABECERA WHERE POLIZA_ID = :id`,
            { id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'DELETE',
                TABLA_AFECTADA: 'POLIZAS_CABECERA',
                REGISTRO_ID: id
            },
            { autoCommit: true }
        );

        res.json({ message: "Póliza eliminada correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al eliminar la póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// CREATE UNIFICADO - crear poliza con detalles (Uso transaccional avanzado)
router.post('/polizas-unificado', verificarToken, async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS, DETALLES } = req.body;

        if (!DETALLES || DETALLES.length < 2) {
            return res.status(400).json({ message: "La póliza debe contener al menos 2 líneas de detalle (partida doble)." });
        }

        connection = await getConnection();

        const resultCabecera = await connection.execute(
            `INSERT INTO POLIZAS_CABECERA (ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS)
            VALUES (:ANIO, :MES, :NUM_POLIZA, TO_DATE(:FECHA, 'YYYY-MM-DD'), :TIPO_POLIZA, :ESTADO, :SINOPSIS)
            RETURNING POLIZA_ID INTO :POLIZA_ID`,
            {
                ANIO, MES, NUM_POLIZA, FECHA: FECHA || null,
                TIPO_POLIZA, ESTADO: ESTADO || 'BORRADOR', SINOPSIS: SINOPSIS || null,
                POLIZA_ID: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            },
            { autoCommit: false }
        );

        const polizaId = resultCabecera.outBinds.POLIZA_ID[0];

        for (const detalle of DETALLES) {
            await connection.execute(
                `INSERT INTO POLIZAS_DETALLE (POLIZA_ID, CUENTA_ID, DEBE, HABER)
                VALUES (:POLIZA_ID, :CUENTA_ID, :DEBE, :HABER)`,
                { polizaId, CUENTA_ID: detalle.CUENTA_ID, DEBE: detalle.DEBE || 0, HABER: detalle.HABER || 0 },
                { autoCommit: false }
            );
        }

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID: req.usuario?.ID || null,
                ACCION: 'INSERT',
                TABLA_AFECTADA: 'POLIZAS_CABECERA',
                REGISTRO_ID: polizaId
            },
            { autoCommit: false }
        );

        await connection.commit();
        res.json({ message: "Póliza creada correctamente", POLIZA_ID: polizaId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "Error interno en la transacción. Póliza no procesada." });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
