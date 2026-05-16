const express = require('express');
const router  = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// ══════════════════════════════════════════════════════════════════════
// MATRIZ DE COHERENCIA CONTABLE — fuente única de verdad
// Exportada también para que el frontend pueda consumirla si se migra
// a un monorepo o se expone como endpoint /api/matriz.
// ══════════════════════════════════════════════════════════════════════
const MATRIZ_CONTABLE = {
    ACTIVO: {
        TIPO_SALDO:          'DEUDOR',
        CLASIFICACION_HOJA:  'BALANCE',           // valor fijo
        SUB_RUBROS:          ['CORRIENTE', 'NO CORRIENTE'],
    },
    PASIVO: {
        TIPO_SALDO:          'ACREEDOR',
        CLASIFICACION_HOJA:  'BALANCE',           // valor fijo
        SUB_RUBROS:          ['CORRIENTE', 'NO CORRIENTE', 'PATRIMONIO'],
    },
    PERDIDA: {
        TIPO_SALDO:          'DEUDOR',
        CLASIFICACIONES_HOJA: ['RESULTADOS', 'COSTO_PRODUCCION', 'COSTO_VENTAS'], // libre dentro del set
        SUB_RUBROS:          ['OPERATIVO'],
    },
    GANANCIA: {
        TIPO_SALDO:          'ACREEDOR',
        CLASIFICACION_HOJA:  'RESULTADOS',        // valor fijo
        SUB_RUBROS:          ['OPERATIVO'],
    },
};

// CHECK constraints de Oracle (inmutables)
const CHECK_ORACLE = {
    TIPO_SALDO:         ['DEUDOR', 'ACREEDOR'],
    CLASIFICACION_HOJA: ['COSTO_PRODUCCION', 'COSTO_VENTAS', 'RESULTADOS', 'BALANCE'],
    RUBRO:              ['ACTIVO', 'PASIVO', 'PERDIDA', 'GANANCIA'],
    ESTADO:             ['ACTIVO', 'INACTIVO'],
};

// ──────────────────────────────────────────────
// Normalización de campos de texto
// ──────────────────────────────────────────────
function normalizarCampos(campos) {
    const r = { ...campos };
    ['NOMBRE', 'RUBRO', 'SUB_RUBRO', 'TIPO_SALDO', 'CLASIFICACION_HOJA', 'ESTADO'].forEach((c) => {
        if (r[c] && typeof r[c] === 'string') r[c] = r[c].toUpperCase().trim();
    });
    return r;
}

// ──────────────────────────────────────────────
// Capa 1 — Constraints de Oracle
// ──────────────────────────────────────────────
function validarConstraintsOracle(campos) {
    const errores = [];
    for (const [campo, permitidos] of Object.entries(CHECK_ORACLE)) {
        if (campos[campo] !== undefined && !permitidos.includes(campos[campo])) {
            errores.push(
                `[CONSTRAINT] "${campo}" = "${campos[campo]}" viola el CHECK de Oracle. ` +
                `Valores permitidos: ${permitidos.join(', ')}.`
            );
        }
    }
    return errores;
}

// ──────────────────────────────────────────────
// Capa 2 — Coherencia contable cruzada
// Verifica RUBRO ↔ TIPO_SALDO ↔ CLASIFICACION_HOJA ↔ SUB_RUBRO
// ──────────────────────────────────────────────
function validarReglasContables({ RUBRO, TIPO_SALDO, CLASIFICACION_HOJA, SUB_RUBRO }) {
    const errores = [];
    const regla   = MATRIZ_CONTABLE[RUBRO];

    if (!regla) {
        errores.push(`[CONTABLE] RUBRO "${RUBRO}" no existe en la Matriz Contable.`);
        return errores;
    }

    // TIPO_SALDO — siempre fijo por RUBRO
    if (TIPO_SALDO !== regla.TIPO_SALDO) {
        errores.push(
            `[CONTABLE] RUBRO "${RUBRO}" requiere TIPO_SALDO = "${regla.TIPO_SALDO}". ` +
            `Se recibió "${TIPO_SALDO}".`
        );
    }

    // CLASIFICACION_HOJA — fija o libre dentro de set (PERDIDA)
    if (regla.CLASIFICACION_HOJA) {
        if (CLASIFICACION_HOJA !== regla.CLASIFICACION_HOJA) {
            errores.push(
                `[CONTABLE] RUBRO "${RUBRO}" requiere CLASIFICACION_HOJA = "${regla.CLASIFICACION_HOJA}". ` +
                `Se recibió "${CLASIFICACION_HOJA}".`
            );
        }
    } else if (regla.CLASIFICACIONES_HOJA) {
        if (!regla.CLASIFICACIONES_HOJA.includes(CLASIFICACION_HOJA)) {
            errores.push(
                `[CONTABLE] RUBRO "${RUBRO}" acepta CLASIFICACION_HOJA en ` +
                `[${regla.CLASIFICACIONES_HOJA.join(', ')}]. Se recibió "${CLASIFICACION_HOJA}".`
            );
        }
    }

    // SUB_RUBRO
    if (!regla.SUB_RUBROS.includes(SUB_RUBRO)) {
        errores.push(
            `[CONTABLE] RUBRO "${RUBRO}" acepta SUB_RUBRO en ` +
            `[${regla.SUB_RUBROS.join(', ')}]. Se recibió "${SUB_RUBRO}".`
        );
    }

    return errores;
}

// Validación completa: Oracle primero, luego contable
function validarCompleto(campos) {
    const errOracle   = validarConstraintsOracle(campos);
    // Si los valores ni siquiera pasan los CHECK de Oracle, no tiene sentido
    // continuar con la lógica contable (evita ruido en los mensajes).
    if (errOracle.length > 0) return errOracle;
    return validarReglasContables(campos);
}

// ══════════════════════════════════════════════════════════════════════
// RUTAS
// ══════════════════════════════════════════════════════════════════════

// ── POST /cuentas ─────────────────────────────────────────────────────
router.post('/cuentas', verificarToken, async (req, res) => {
    let connection;
    try {
        const campos = normalizarCampos(req.body);
        const { CUENTA_ID, NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO } = campos;

        const faltantes = ['CUENTA_ID', 'NOMBRE', 'TIPO_SALDO', 'CLASIFICACION_HOJA', 'RUBRO', 'SUB_RUBRO']
            .filter((k) => !campos[k]);
        if (faltantes.length > 0) {
            return res.status(400).json({
                message: 'Campos obligatorios faltantes.',
                errores: faltantes.map((f) => `[REQUERIDO] "${f}" es obligatorio.`),
            });
        }

        const errores = validarCompleto(campos);
        if (errores.length > 0) {
            return res.status(400).json({ message: 'Error de coherencia contable.', errores });
        }

        connection = await getConnection();

        await connection.execute(
            `INSERT INTO CATALOGO_CUENTAS
             (CUENTA_ID, NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO)
             VALUES (:CUENTA_ID, :NOMBRE, :TIPO_SALDO, :CLASIFICACION_HOJA, :RUBRO, :SUB_RUBRO, :ESTADO)`,
            { CUENTA_ID, NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO: ESTADO || 'ACTIVO' },
            { autoCommit: true }
        );

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, ACCION: 'INSERT', TABLA_AFECTADA: 'CATALOGO_CUENTAS', REGISTRO_ID: CUENTA_ID },
            { autoCommit: true }
        );

        res.status(201).json({ message: 'Cuenta creada correctamente.' });

    } catch (err) {
        console.error(err);
        if (err.errorNum === 1) return res.status(409).json({ message: 'Ya existe una cuenta con ese ID.' });
        res.status(500).json({ message: 'Error interno al crear la cuenta.' });
    } finally {
        if (connection) await connection.close();
    }
});

// ── GET /cuentas ──────────────────────────────────────────────────────
router.get('/cuentas', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM CATALOGO_CUENTAS ORDER BY CUENTA_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener el catálogo de cuentas.' });
    } finally {
        if (connection) await connection.close();
    }
});

// ── GET /cuentas/:id ──────────────────────────────────────────────────
router.get('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM CATALOGO_CUENTAS WHERE CUENTA_ID = :id`,
            { id: req.params.id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Cuenta no encontrada.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al buscar la cuenta.' });
    } finally {
        if (connection) await connection.close();
    }
});

// ── PUT /cuentas/:id — también sirve para RESCATAR registros corruptos ─
router.put('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id     = req.params.id;
        const campos = normalizarCampos(req.body);
        const { NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO } = campos;

        const faltantes = ['NOMBRE', 'TIPO_SALDO', 'CLASIFICACION_HOJA', 'RUBRO', 'SUB_RUBRO', 'ESTADO']
            .filter((k) => !campos[k]);
        if (faltantes.length > 0) {
            return res.status(400).json({
                message: 'Campos obligatorios faltantes.',
                errores: faltantes.map((f) => `[REQUERIDO] "${f}" es obligatorio.`),
            });
        }

        const errores = validarCompleto(campos);
        if (errores.length > 0) {
            return res.status(400).json({ message: 'Error de coherencia contable.', errores });
        }

        connection = await getConnection();

        const result = await connection.execute(
            `UPDATE CATALOGO_CUENTAS
             SET NOMBRE             = :NOMBRE,
                 TIPO_SALDO         = :TIPO_SALDO,
                 CLASIFICACION_HOJA = :CLASIFICACION_HOJA,
                 RUBRO              = :RUBRO,
                 SUB_RUBRO          = :SUB_RUBRO,
                 ESTADO             = :ESTADO
             WHERE CUENTA_ID = :id`,
            { NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO, id },
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) return res.status(404).json({ message: 'Cuenta no encontrada.' });

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, ACCION: 'UPDATE', TABLA_AFECTADA: 'CATALOGO_CUENTAS', REGISTRO_ID: id },
            { autoCommit: true }
        );

        res.json({ message: 'Cuenta actualizada correctamente.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar la cuenta.' });
    } finally {
        if (connection) await connection.close();
    }
});

// ── DELETE /cuentas/:id — depuración de registros insalvables ─────────
router.delete('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id = req.params.id;
        connection = await getConnection();

        const result = await connection.execute(
            `DELETE FROM CATALOGO_CUENTAS WHERE CUENTA_ID = :id`,
            { id },
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) return res.status(404).json({ message: 'Cuenta no encontrada.' });

        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            { USER_ID: req.usuario?.ID || null, ACCION: 'DELETE', TABLA_AFECTADA: 'CATALOGO_CUENTAS', REGISTRO_ID: id },
            { autoCommit: true }
        );

        res.json({ message: 'Cuenta eliminada correctamente.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar la cuenta.' });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
