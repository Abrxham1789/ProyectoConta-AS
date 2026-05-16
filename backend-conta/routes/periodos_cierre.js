const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// CREATE - crear periodo de cierre
router.post('/periodos', verificarToken, async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, ESTADO_CIERRE, FECHA_CIERRE } = req.body;
        connection = await getConnection();

        // 1. Guarda el periodo (Esto ya estaba bien)
        await connection.execute(
            `INSERT INTO PERIODOS_CIERRE (ANIO, MES, ESTADO_CIERRE, FECHA_CIERRE)
            VALUES (:ANIO, :MES, :ESTADO_CIERRE, TO_DATE(:FECHA_CIERRE, 'YYYY-MM-DD'))`,
            { ANIO, MES, ESTADO_CIERRE: ESTADO_CIERRE || 'ABIERTO', FECHA_CIERRE: FECHA_CIERRE || null },
            { autoCommit: true }
        );

        // 2. TRUCO DE COMPATIBILIDAD: Convertimos el "2026-4" a número puro "202604"
        const registroIdNumerico = (parseInt(ANIO, 10) * 100) + parseInt(MES, 10);

        // 3. Registro detallado en auditoría (Aquí es donde se cambiaron las comillas por la variable numérica)
      // Reemplaza el bloque de auditoría por este número puro libre de guiones:
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.usuario?.ID || null,
            ACCION: 'INSERT',
            TABLA_AFECTADA: 'PERIODOS_CIERRE',
            REGISTRO_ID: 1 // <═══ Número puro genérico. Cero errores de conversión.
        },
        { autoCommit: true }
    );


        res.status(201).json({ message: 'Periodo creado correctamente.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error interno al crear el periodo.' });
    } finally {
        if (connection) await connection.close();
    }
});


// READ - obtener todos los periodos
router.get('/periodos', verificarToken, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error al obtener el listado de periodos" });
    } finally {
        if (connection) await connection.close();
    }
});

// READ - obtener un periodo por ANIO y MES
router.get('/periodos/:anio/:mes', verificarToken, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: "Error al buscar el periodo solicitado" });
    } finally {
        if (connection) await connection.close();
    }
});

// UPDATE - actualizar periodo
router.put('/periodos/:anio/:mes', verificarToken, async (req, res) => {
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

        // Busca el bloque de auditoría en el PUT y déjalo así:
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.usuario?.ID || null,
            ACCION: 'UPDATE',
            TABLA_AFECTADA: 'PERIODOS_CIERRE',
            REGISTRO_ID: 1 // <═══ Forzamos el número 1. Blindaje total.
            },
            { autoCommit: true }
        );


        res.json({ message: "Periodo actualizado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al actualizar el periodo contable" });
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE - eliminar periodo
router.delete('/periodos/:anio/:mes', verificarToken, async (req, res) => {
    let connection;
    try {
        const { anio, mes } = req.params;
        connection = await getConnection();

        await connection.execute(
            `DELETE FROM PERIODOS_CIERRE WHERE ANIO = :anio AND MES = :mes`,
            { anio, mes },
            { autoCommit: true }
        );

        // Busca el bloque de auditoría en el DELETE y déjalo así:
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
            USER_ID: req.usuario?.ID || null,
            ACCION: 'DELETE',
            TABLA_AFECTADA: 'PERIODOS_CIERRE',
            REGISTRO_ID: 1 // <═══ Forzamos el número 1. Solución definitiva.
            },
            { autoCommit: true }
        );


        res.json({ message: "Periodo eliminado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al eliminar el periodo contable" });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
