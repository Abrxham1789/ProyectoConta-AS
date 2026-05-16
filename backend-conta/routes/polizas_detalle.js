const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// ────────────────────────────────────────────────────────────
// AUXILIAR: Verifica el cuadre general de la póliza afectada
// ────────────────────────────────────────────────────────────
async function verificarCuadrePoliza(connection, polizaId, detalleIdExcluido = null, nuevoDebe = 0, nuevoHaber = 0, cuentaIdNueva = null) {
    // 1. Consultar todos los movimientos actuales de la póliza en la base de datos
    const result = await connection.execute(
        `SELECT DETALLE_ID, DEBE, HABER, CUENTA_ID FROM POLIZAS_DETALLE WHERE POLIZA_ID = :polizaId`,
        { polizaId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let sumaDebe = 0;
    let sumaHaber = 0;
    let lineasActivas = 0;

    // 2. Simular el impacto en memoria antes de guardar en las tablas de Oracle
    result.rows.forEach(row => {
        if (detalleIdExcluido && row.DETALLE_ID === parseInt(detalleIdExcluido)) {
            // Si es un UPDATE, reemplazamos el valor viejo por el que viene del formulario
            sumaDebe += nuevoDebe;
            sumaHaber += nuevoHaber;
            if (nuevoDebe > 0 || nuevoHaber > 0) lineasActivas++;
        } else {
            // Si es otra línea, sumamos su valor actual de la BD
            sumaDebe += parseFloat(row.DEBE) || 0;
            sumaHaber += parseFloat(row.HABER) || 0;
            lineasActivas++;
        }
    });

    // Si es un INSERT individual (no un update), sumamos la nueva línea proyectada
    if (!detalleIdExcluido) {
        sumaDebe += nuevoDebe;
        sumaHaber += nuevoHaber;
        lineasActivas++;
    }

    // 3. Validaciones estrictas de consistencia
    const errores = [];
    if (lineasActivas < 2) {
        errores.push("Operación rechazada: La póliza no puede quedar con menos de 2 líneas con movimientos.");
    }
    if (Math.abs(sumaDebe - sumaHaber) > 0.01) {
        errores.push(`Descuadre contable detectado: Con este cambio la póliza quedaría rota. Suma Proyectada DEBE: Q${sumaDebe.toFixed(2)} ≠ HABER: Q${sumaHaber.toFixed(2)}. Diferencia: Q${Math.abs(sumaDebe - sumaHaber).toFixed(2)}.`);
    }

    return errores;
}

// ────────────────────────────────────────────────────────────
// CREATE — Crear detalle individual (Protegido contra descuadres)
// ────────────────────────────────────────────────────────────
router.post('/polizas-detalle', verificarToken, async (req, res) => {
    let connection;
    try {
        const { POLIZA_ID, CUENTA_ID, DEBE, HABER } = req.body;
        if (!POLIZA_ID || !CUENTA_ID) return res.status(400).json({ message: "POLIZA_ID y CUENTA_ID son obligatorios." });

        const mDebe = parseFloat(DEBE) || 0;
        const mHaber = parseFloat(HABER) || 0;

        if (mDebe < 0 || mHaber < 0 || (mDebe > 0 && mHaber > 0)) {
            return res.status(400).json({ message: "Los montos no pueden ser negativos ni estar cargados simultáneamente en la misma línea." });
        }

        connection = await getConnection();

        // VALIDACIÓN DE IMPACTO ANTES DEL COMMIT
        const erroresContables = await verificarCuadrePoliza(connection, POLIZA_ID, null, mDebe, mHaber, CUENTA_ID);
        if (erroresContables.length > 0) {
            return res.status(400).json({ message: "Operación rechazada por inconsistencia.", errores: erroresContables });
        }

        await connection.execute(
            `INSERT INTO POLIZAS_DETALLE (POLIZA_ID, CUENTA_ID, DEBE, HABER)
            VALUES (:POLIZA_ID, :CUENTA_ID, :DEBE, :HABER)`,
            { POLIZA_ID, CUENTA_ID, DEBE: mDebe, HABER: mHaber },
            { autoCommit: true }
        );

        // Registro de Auditoría
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, 'INSERT', 'POLIZAS_DETALLE', :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, REGISTRO_ID: `${POLIZA_ID}-${CUENTA_ID}` },
            { autoCommit: true }
        );

        res.json({ message: "Detalle de póliza creado y validado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error interno al insertar el detalle de póliza" });
    } finally {
        if (connection) await connection.close();
    }
});

// ────────────────────────────────────────────────────────────
// UPDATE — Actualizar línea individual (Rescate seguro de datos viejos)
// ────────────────────────────────────────────────────────────
router.put('/polizas-detalle/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { POLIZA_ID, CUENTA_ID, DEBE, HABER } = req.body;

        const mDebe = parseFloat(DEBE) || 0;
        const mHaber = parseFloat(HABER) || 0;

        if (mDebe < 0 || mHaber < 0 || (mDebe > 0 && mHaber > 0)) {
            return res.status(400).json({ message: "Estructura de importes inválida." });
        }

        connection = await getConnection();

        // VALIDACIÓN DE IMPACTO: Simula cómo quedaría la póliza si guardas este cambio
        const erroresContables = await verificarCuadrePoliza(connection, POLIZA_ID, id, mDebe, mHaber, CUENTA_ID);
        if (erroresContables.length > 0) {
            return res.status(400).json({ message: "La actualización rompería el balance de la partida.", errores: erroresContables });
        }

        await connection.execute(
            `UPDATE POLIZAS_DETALLE
            SET POLIZA_ID = :POLIZA_ID, CUENTA_ID = :CUENTA_ID, DEBE = :DEBE, HABER = :HABER
            WHERE DETALLE_ID = :id`,
            { POLIZA_ID, CUENTA_ID, DEBE: mDebe, HABER: mHaber, id },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, 'UPDATE', 'POLIZAS_DETALLE', :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, REGISTRO_ID: id },
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

// READ - Obtener todos los detalles
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

// READ - Obtener detalles por POLIZA_ID
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

// READ - Obtener un detalle por ID
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
        if (result.rows.length === 0) return res.status(404).json({ message: "Detalle no encontrado" });
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al buscar the detalle especificado" });
    } finally {
        if (connection) await connection.close();
    }
});

// DELETE — Eliminar línea (Protección contra desbalanceo parcial)
router.delete('/polizas-detalle/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        connection = await getConnection();

        // 1. Obtener a qué póliza pertenece el registro antes de borrarlo
        const findPoliza = await connection.execute(
            `SELECT POLIZA_ID FROM POLIZAS_DETALLE WHERE DETALLE_ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (findPoliza.rows.length > 0) {
            const pId = findPoliza.rows[0].POLIZA_ID;
            // Evaluamos si borrar esta línea destruye la partida doble de la cabecera
            const erroresContables = await verificarCuadrePoliza(connection, pId, id, 0, 0, null);
            if (erroresContables.length > 0) {
                return res.status(400).json({ message: "No se puede eliminar la línea suelta.", errores: erroresContables });
            }
        }

        await connection.execute(`DELETE FROM POLIZAS_DETALLE WHERE DETALLE_ID = :id`, { id }, { autoCommit: true });

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
            VALUES (:USER_ID, 'DELETE', 'POLIZAS_DETALLE', :REGISTRO_ID)`,
            { typeof: req.usuario?.ID || null, REGISTRO_ID: id },
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

