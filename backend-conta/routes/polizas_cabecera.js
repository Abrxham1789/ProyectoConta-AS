const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');
 
// ────────────────────────────────────────────────────────────
// HELPERS DE VALIDACIÓN BACKEND (segunda línea de defensa)
// ────────────────────────────────────────────────────────────
 
/** Detecta 4 o más caracteres idénticos consecutivos */
const tieneCaracteresRepetidos = (val) => /(.)\1{3,}/.test(String(val));
 
/**
 * Valida los campos de la cabecera con regex estrictos.
 * Retorna un array de errores (vacío = todo OK).
 */
function validarCamposCabecera({ ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, SINOPSIS }) {
    const errores = [];
 
    // AÑO
    if (!ANIO || !/^\d{4}$/.test(String(ANIO))) {
        errores.push('ANIO: Debe ser exactamente 4 dígitos numéricos.');
    } else {
        const a = parseInt(ANIO, 10);
        if (a < 2000 || a > 2030) errores.push('ANIO: Debe estar entre 2000 y 2030.');
    }
 
    // MES
    if (!MES || !/^\d{1,2}$/.test(String(MES))) {
        errores.push('MES: Solo 1 o 2 dígitos numéricos.');
    } else {
        const m = parseInt(MES, 10);
        if (m < 1 || m > 12) errores.push('MES: Debe estar entre 1 y 12.');
    }
 
    // NUM_POLIZA
    if (!NUM_POLIZA || !/^\d{1,8}$/.test(String(NUM_POLIZA))) {
        errores.push('NUM_POLIZA: Solo números, máximo 8 dígitos.');
    }
 
    // FECHA — formato YYYY-MM-DD
    if (!FECHA || !/^\d{4}-\d{2}-\d{2}$/.test(String(FECHA))) {
        errores.push('FECHA: Formato requerido YYYY-MM-DD.');
    } else {
        const d = new Date(FECHA);
        if (isNaN(d.getTime())) errores.push('FECHA: Fecha inválida.');
    }
 
    // TIPO_POLIZA
    const tiposValidos = ['APERTURA', 'DIARIO', 'AJUSTE', 'CIERRE'];
    if (!TIPO_POLIZA || !tiposValidos.includes(String(TIPO_POLIZA).toUpperCase())) {
        errores.push(`TIPO_POLIZA: Debe ser uno de: ${tiposValidos.join(', ')}.`);
    }
 
    // SINOPSIS
    if (!SINOPSIS || String(SINOPSIS).trim() === '') {
        errores.push('SINOPSIS: Campo obligatorio.');
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(String(SINOPSIS))) {
        errores.push('SINOPSIS: Solo letras y espacios.');
    } else if (String(SINOPSIS).length > 20) {
        errores.push('SINOPSIS: Máximo 20 caracteres.');
    } else if (tieneCaracteresRepetidos(SINOPSIS)) {
        errores.push('SINOPSIS: Caracteres repetidos abusivamente detectados.');
    }
 
    return errores;
}
 
/**
 * Valida la partida doble del array de detalles.
 * Retorna un array de errores (vacío = OK).
 */
function validarPartidaDoble(detalles) {
    const errores = [];
    let sumaDebe  = 0;
    let sumaHaber = 0;
 
    detalles.forEach((d, index) => {
        const debe  = parseFloat(d.DEBE)  || 0;
        const haber = parseFloat(d.HABER) || 0;
 
        sumaDebe  += debe;
        sumaHaber += haber;
 
        if (debe < 0 || haber < 0) {
            errores.push(`Línea ${index + 1}: Los montos no pueden ser negativos.`);
        }
        if (debe > 0 && haber > 0) {
            errores.push(`Línea ${index + 1}: No se puede cargar y abonar simultáneamente en el mismo renglón.`);
        }
        if (!d.CUENTA_ID) {
            errores.push(`Línea ${index + 1}: CUENTA_ID es obligatorio.`);
        }
    });
 
    if (Math.abs(sumaDebe - sumaHaber) > 0.01) {
        errores.push(
            `Partida Doble: Póliza descuadrada. DEBE (Q${sumaDebe.toFixed(2)}) ≠ HABER (Q${sumaHaber.toFixed(2)}). ` +
            `Diferencia: Q${Math.abs(sumaDebe - sumaHaber).toFixed(2)}.`
        );
    }
 
    return errores;
}
 
// ────────────────────────────────────────────────────────────
// CREATE — Póliza cabecera individual
// ────────────────────────────────────────────────────────────
router.post('/polizas-cabecera', verificarToken, async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS } = req.body;
 
        const errores = validarCamposCabecera({ ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, SINOPSIS });
        if (errores.length > 0) return res.status(400).json({ message: 'Validación fallida.', errors: errores });
 
        connection = await getConnection();
 
        await connection.execute(
            `INSERT INTO POLIZAS_CABECERA (ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS)
             VALUES (:ANIO, :MES, :NUM_POLIZA, TO_DATE(:FECHA, 'YYYY-MM-DD'), :TIPO_POLIZA, :ESTADO, :SINOPSIS)`,
            { ANIO, MES, NUM_POLIZA, FECHA: FECHA || null, TIPO_POLIZA,
              ESTADO: ESTADO || 'BORRADOR', SINOPSIS: SINOPSIS || null },
            { autoCommit: true }
        );
 
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, 'INSERT', 'POLIZAS_CABECERA', :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, REGISTRO_ID: `${ANIO}-${MES}-${NUM_POLIZA}` },
            { autoCommit: true }
        );
 
        res.json({ message: 'Póliza cabecera creada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error interno al crear la cabecera de la póliza.' });
    } finally {
        if (connection) await connection.close();
    }
});
 
// ────────────────────────────────────────────────────────────
// READ — Todas las pólizas
// ────────────────────────────────────────────────────────────
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
        res.status(500).json({ message: 'Error al obtener el listado de pólizas.' });
    } finally {
        if (connection) await connection.close();
    }
});
 
// ────────────────────────────────────────────────────────────
// READ — Por ID
// ────────────────────────────────────────────────────────────
router.get('/polizas-cabecera/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM POLIZAS_CABECERA WHERE POLIZA_ID = :id`,
            { id: req.params.id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Póliza no encontrada.' });
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al buscar la póliza.' });
    } finally {
        if (connection) await connection.close();
    }
});
 
// ────────────────────────────────────────────────────────────
// UPDATE — Cabecera
// ────────────────────────────────────────────────────────────
router.put('/polizas-cabecera/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS } = req.body;
 
        const errores = validarCamposCabecera({ ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, SINOPSIS });
        if (errores.length > 0) return res.status(400).json({ message: 'Validación fallida.', errors: errores });
 
        connection = await getConnection();
 
        await connection.execute(
            `UPDATE POLIZAS_CABECERA
             SET ANIO = :ANIO, MES = :MES, NUM_POLIZA = :NUM_POLIZA,
                 FECHA = TO_DATE(:FECHA, 'YYYY-MM-DD'),
                 TIPO_POLIZA = :TIPO_POLIZA, ESTADO = :ESTADO, SINOPSIS = :SINOPSIS
             WHERE POLIZA_ID = :id`,
            { ANIO, MES, NUM_POLIZA, FECHA: FECHA || null,
              TIPO_POLIZA, ESTADO, SINOPSIS: SINOPSIS || null, id },
            { autoCommit: true }
        );
 
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, 'UPDATE', 'POLIZAS_CABECERA', :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, REGISTRO_ID: id },
            { autoCommit: true }
        );
 
        res.json({ message: 'Póliza actualizada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar la póliza.' });
    } finally {
        if (connection) await connection.close();
    }
});
 
// ────────────────────────────────────────────────────────────
// DELETE — Cabecera
// ────────────────────────────────────────────────────────────
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
             VALUES (:USER_ID, 'DELETE', 'POLIZAS_CABECERA', :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, REGISTRO_ID: id },
            { autoCommit: true }
        );
 
        res.json({ message: 'Póliza eliminada correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar la póliza.' });
    } finally {
        if (connection) await connection.close();
    }
});
 
// ────────────────────────────────────────────────────────────
// CREATE UNIFICADO — Cabecera + Detalles en una sola transacción
// ────────────────────────────────────────────────────────────
router.post('/polizas-unificado', verificarToken, async (req, res) => {
    let connection;
    try {
        const { ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS, DETALLES } = req.body;
 
        // 1. Validación estructural mínima
        if (!DETALLES || DETALLES.length < 2) {
            return res.status(400).json({
                message: 'La póliza debe tener al menos 2 líneas de detalle (partida doble).',
            });
        }
 
        // 2. Validación de campos de cabecera
        const erroresCabecera = validarCamposCabecera({ ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, SINOPSIS });
        if (erroresCabecera.length > 0) {
            return res.status(400).json({ message: 'Error en la cabecera.', errors: erroresCabecera });
        }
 
        // 3. Validación contable de detalles (partida doble)
        const erroresContables = validarPartidaDoble(DETALLES);
        if (erroresContables.length > 0) {
            return res.status(400).json({
                message: 'Error de consistencia contable. La póliza fue rechazada.',
                errors: erroresContables,
            });
        }
 
        connection = await getConnection();
 
        // ── 3.5 ESCUDO CONTABLE: VALIDACIÓN CRUZADA CONTRA PERÍODOS DE CIERRE ──
        // Verificamos en Oracle si el Año y Mes digitados ya fueron clausurados
        const queryPeriodo = `
            SELECT ESTADO_CIERRE 
            FROM PERIODOS_CIERRE 
            WHERE ANIO = :ANIO AND MES = :MES
        `;
        
        const resultPeriodo = await connection.execute(
            queryPeriodo,
            { ANIO: parseInt(ANIO, 10), MES: parseInt(MES, 10) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (resultPeriodo.rows.length > 0) {
            const estadoPeriodo = resultPeriodo.rows[0].ESTADO_CIERRE;
            
            if (estadoPeriodo === 'CERRADO') {
                return res.status(400).json({ 
                    message: `⚠️ Operación Rechazada: El período contable [Mes ${MES} - Año ${ANIO}] ya se encuentra cerrado/clausurado. No se permiten registrar pólizas en meses finalizados.` 
                });
            }
        } else {
            // Regla opcional: Obliga a que den de alta el año/mes en periodos antes de operar pólizas
            return res.status(400).json({ 
                message: `⚠️ Período no registrado: El ejercicio [Mes ${MES} - Año ${ANIO}] no está dado de alta en los períodos de cierre de Oracle Cloud.` 
            });
        }

        // ── 4. INSERTAR CABECERA (Si pasó el escudo contable anterior) ──
        const resultCabecera = await connection.execute(
            `INSERT INTO POLIZAS_CABECERA (ANIO, MES, NUM_POLIZA, FECHA, TIPO_POLIZA, ESTADO, SINOPSIS)
             VALUES (:ANIO, :MES, :NUM_POLIZA, TO_DATE(:FECHA, 'YYYY-MM-DD'), :TIPO_POLIZA, :ESTADO, :SINOPSIS)
             RETURNING POLIZA_ID INTO :POLIZA_ID`,
            {
                ANIO, MES, NUM_POLIZA, FECHA: FECHA || null,
                TIPO_POLIZA, ESTADO: ESTADO || 'BORRADOR', SINOPSIS: SINOPSIS || null,
                POLIZA_ID: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            },
            { autoCommit: false }
        );
 
        const polizaId = resultCabecera.outBinds.POLIZA_ID[0];
 
        // 5. Insertar cada línea de detalle
        for (const detalle of DETALLES) {
            await connection.execute(
                `INSERT INTO POLIZAS_DETALLE (POLIZA_ID, CUENTA_ID, DEBE, HABER)
                 VALUES (:POLIZA_ID, :CUENTA_ID, :DEBE, :HABER)`,
                {
                    POLIZA_ID: polizaId,
                    CUENTA_ID: detalle.CUENTA_ID,
                    DEBE:  parseFloat(detalle.DEBE)  || 0,
                    HABER: parseFloat(detalle.HABER) || 0,
                },
                { autoCommit: false }
            );
        }
 
        // 6. Auditoría
        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, 'INSERT_UNIFICADO', 'POLIZAS_CABECERA', :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, REGISTRO_ID: polizaId },
            { autoCommit: false }
        );
 
        // 7. Commit solo si todo fue exitoso
        await connection.commit();
        res.json({ message: 'Póliza creada y cuadrada correctamente.', POLIZA_ID: polizaId });
 
    } catch (err) {
        // Rollback completo si algo falla
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).json({
            message: 'Error interno en la transacción. Póliza revertida automáticamente.',
        });
    } finally {
        if (connection) await connection.close();
    }
});
 
module.exports = router;


