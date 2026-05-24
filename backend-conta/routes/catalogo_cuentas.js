const express  = require('express');
const router   = express.Router();
const { getConnection } = require('../database');
const oracledb = require('oracledb');
const verificarToken = require('../middlewares/auth');

// ══════════════════════════════════════════════════════════════════════
// MATRIZ DE COHERENCIA CONTABLE — fuente única de verdad
// ══════════════════════════════════════════════════════════════════════
const MATRIZ_CONTABLE = {
    ACTIVO: {
        TIPO_SALDO:           'DEUDOR',
        CLASIFICACION_HOJA:   'BALANCE',
        SUB_RUBROS:           ['CORRIENTE', 'NO CORRIENTE'],
    },
    PASIVO: {
        TIPO_SALDO:           'ACREEDOR',
        CLASIFICACION_HOJA:   'BALANCE',
        SUB_RUBROS:           ['CORRIENTE', 'NO CORRIENTE', 'PATRIMONIO'],
    },
    PERDIDA: {
        TIPO_SALDO:           'DEUDOR',
        CLASIFICACIONES_HOJA: ['RESULTADOS', 'COSTO_PRODUCCION', 'COSTO_VENTAS'],
        SUB_RUBROS:           ['OPERATIVO'],
    },
    GANANCIA: {
        TIPO_SALDO:           'ACREEDOR',
        CLASIFICACION_HOJA:   'RESULTADOS',
        SUB_RUBROS:           ['OPERATIVO'],
    },
};

// CHECK constraints de Oracle (inmutables)
const CHECK_ORACLE = {
    TIPO_SALDO:         ['DEUDOR', 'ACREEDOR'],
    CLASIFICACION_HOJA: ['COSTO_PRODUCCION', 'COSTO_VENTAS', 'RESULTADOS', 'BALANCE'],
    RUBRO:              ['ACTIVO', 'PASIVO', 'PERDIDA', 'GANANCIA'],
    ESTADO:             ['ACTIVO', 'INACTIVO'],
};

// ══════════════════════════════════════════════════════════════════════
// REQ 1 — Regex para validar formato de CUENTA_ID
// ✔ Solo dígitos: "1101"  ✔ Dígitos con guiones: "1-1-01"
// ✗ Solo guiones  ✗ Guiones consecutivos  ✗ Guión al inicio/final
// ══════════════════════════════════════════════════════════════════════
const REGEX_CUENTA_ID = /^(?!^-+$)[0-9]+(-[0-9]+)*$/;

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
// ──────────────────────────────────────────────
function validarReglasContables({ RUBRO, TIPO_SALDO, CLASIFICACION_HOJA, SUB_RUBRO }) {
    const errores = [];
    const regla   = MATRIZ_CONTABLE[RUBRO];

    if (!regla) {
        errores.push(`[CONTABLE] RUBRO "${RUBRO}" no existe en la Matriz Contable.`);
        return errores;
    }
    if (TIPO_SALDO !== regla.TIPO_SALDO) {
        errores.push(
            `[CONTABLE] RUBRO "${RUBRO}" requiere TIPO_SALDO = "${regla.TIPO_SALDO}". ` +
            `Se recibió "${TIPO_SALDO}".`
        );
    }
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
    if (!regla.SUB_RUBROS.includes(SUB_RUBRO)) {
        errores.push(
            `[CONTABLE] RUBRO "${RUBRO}" acepta SUB_RUBRO en ` +
            `[${regla.SUB_RUBROS.join(', ')}]. Se recibió "${SUB_RUBRO}".`
        );
    }
    return errores;
}

function validarCompleto(campos) {
    const errOracle = validarConstraintsOracle(campos);
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
        const { NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO } = campos;
        // Extraemos NUM_REFERENCIA directo de req.body (sin forzar mayúsculas) por si contiene letras de series o formatos especiales
        const NUM_REFERENCIA = req.body.NUM_REFERENCIA ? String(req.body.NUM_REFERENCIA).trim() : null;
        const CUENTA_ID_RAW = req.body.CUENTA_ID ? String(req.body.CUENTA_ID).trim() : '';

        // Campos faltantes
        const faltantes = ['CUENTA_ID', 'NOMBRE', 'TIPO_SALDO', 'CLASIFICACION_HOJA', 'RUBRO', 'SUB_RUBRO']
            .filter((k) => !campos[k]);
        if (faltantes.length > 0) {
            return res.status(400).json({
                message: 'Campos obligatorios faltantes.',
                errores: faltantes.map((f) => `[REQUERIDO] "${f}" es obligatorio.`),
            });
        }

        // REQ 3 — Validación de nombre mínimo
        if (campos.NOMBRE.trim().length < 3) {
            return res.status(400).json({
                message: 'Nombre inválido.',
                errores: ['[NOMBRE] El nombre de la cuenta es inválido o demasiado corto (mínimo 3 caracteres).'],
            });
        }

        // REQ 1 — Validación formato CUENTA_ID
        if (!REGEX_CUENTA_ID.test(campos.CUENTA_ID)) {
            return res.status(400).json({
                message: 'Formato de ID inválido.',
                errores: [
                    '[FORMATO] El ID de cuenta debe ser numérico o seguir un formato contable válido ' +
                    '(ej: 1-10-01 o 11001). No se permiten guiones aislados o consecutivos.',
                ],
            });
        }

            // NUEVA VALIDACIÓN: Verificar si cumple con el rango asignado a subcuentas de bancos (Bancos / Disponible)
        const esCuentaDeBanco = 
            (CUENTA_ID_RAW.startsWith('1-10') && CUENTA_ID_RAW.replace(/[- ]/g, '').length === 5) || 
            (CUENTA_ID_RAW.startsWith('110') && CUENTA_ID_RAW.replace(/[- ]/g, '').length === 5);

            if (esCuentaDeBanco && (!NUM_REFERENCIA || NUM_REFERENCIA === '')) {
                return res.status(400).json({
                    message: 'Falta número de referencia.',
                    errores: ['[BANCOS] El campo "Número de Referencia / Cuenta Bancaria" es obligatorio para este nivel de detalle disponible.'],
                });
        }


        // REQ 1 — Sanitización: solo dígitos para Oracle NUMBER
        const CUENTA_ID_LIMPIO = campos.CUENTA_ID.replace(/[- ]/g, '');

        // Coherencia contable
        const errores = validarCompleto(campos);
        if (errores.length > 0) {
            return res.status(400).json({ message: 'Error de coherencia contable.', errores });
        }

        connection = await getConnection();

        // BUSCA TU PRIMER connection.execute Y REEMPLÁZALO COMPLETO:
        await connection.execute(
            `INSERT INTO CATALOGO_CUENTAS
            (CUENTA_ID, NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO, NUM_REFERENCIA)
            VALUES (:CUENTA_ID, :NOMBRE, :TIPO_SALDO, :CLASIFICACION_HOJA, :RUBRO, :SUB_RUBRO, :ESTADO, :NUM_REFERENCIA)`,
            {
                CUENTA_ID: CUENTA_ID_LIMPIO,
                NOMBRE, 
                TIPO_SALDO, 
                CLASIFICACION_HOJA, 
                RUBRO, 
                SUB_RUBRO,
                ESTADO: ESTADO || 'ACTIVO',
                // Si no es cuenta de banco, pasará un valor null nativo que Oracle acepta sin problemas
                NUM_REFERENCIA: esCuentaDeBanco ? NUM_REFERENCIA : null, 
            },
            { autoCommit: true }
        );


        await connection.execute(
            `INSERT INTO LOGS_AUDITORIA (USER_ID, ACCION, TABLA_AFECTADA, REGISTRO_ID)
             VALUES (:USER_ID, :ACCION, :TABLA_AFECTADA, :REGISTRO_ID)`,
            {
                USER_ID:        req.usuario?.ID || null,
                ACCION:         'INSERT',
                TABLA_AFECTADA: 'CATALOGO_CUENTAS',
                REGISTRO_ID:    CUENTA_ID_LIMPIO,
            },
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

// ══════════════════════════════════════════════════════════════════════
// GET /cuentas
// REQ 3 — ?prefijo=N  → filtra por primer dígito (clase contable)
// REQ 4 — ?search=X   → búsqueda libre por código o nombre
//
// Lógica de prioridad:
//   Si llega "search"  → usa LIKE doble (código + nombre)
//   Si llega "prefijo" → filtra solo por primer dígito
//   Sin parámetros     → devuelve todo
// ══════════════════════════════════════════════════════════════════════
router.get('/cuentas', verificarToken, async (req, res) => {
    let connection;
    try {
        const { prefijo, search } = req.query;

        let whereClause = '';
        const binds = {};

        if (search && search.trim() !== '') {
            // REQ 4 — Búsqueda libre: coincide con código O nombre
            whereClause = `WHERE (TO_CHAR(CUENTA_ID) LIKE :search || '%' OR UPPER(NOMBRE) LIKE '%' || UPPER(:searchNombre) || '%')`;
            binds.search       = search.trim();
            binds.searchNombre = search.trim();
        } else if (prefijo && /^[0-9]$/.test(prefijo)) {
            // REQ 3 — Filtro por clase contable (primer dígito)
            whereClause = `WHERE TO_CHAR(CUENTA_ID) LIKE :prefijo`;
            binds.prefijo = `${prefijo}%`;
        }

        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM CATALOGO_CUENTAS ${whereClause} ORDER BY CUENTA_ID ASC`,
            binds,
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

// ══════════════════════════════════════════════════════════════════════
// GET /cuentas/check-duplicado
// REQ 3 — Verificación asíncrona de duplicados antes de guardar.
//
// Query params aceptados (al menos uno requerido):
//   ?id=11005          → verifica si CUENTA_ID ya existe
//   ?nombre=Caja       → verifica si NOMBRE ya existe (case-insensitive)
//   ?nombre=Caja&excludeId=11005  → excluye la cuenta actual (para edición)
//
// Respuesta:
//   { existe: true,  campo: 'id'|'nombre', mensaje: '...' }
//   { existe: false }
// ══════════════════════════════════════════════════════════════════════
router.get('/cuentas/check-duplicado', verificarToken, async (req, res) => {
    let connection;
    try {
        const { id, nombre, excludeId } = req.query;

        if (!id && !nombre) {
            return res.status(400).json({ message: 'Proporciona al menos "id" o "nombre" como query param.' });
        }

        connection = await getConnection();

        // ── Verificar duplicado de ID ──────────────────────────────
        if (id) {
            const idLimpio = String(id).replace(/[- ]/g, '');
            if (!/^\d+$/.test(idLimpio)) {
                // ID con formato inválido → no consultamos Oracle para evitar error
                return res.json({ existe: false });
            }
            const r = await connection.execute(
                `SELECT COUNT(*) AS CNT FROM CATALOGO_CUENTAS WHERE CUENTA_ID = :id`,
                { id: Number(idLimpio) },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            if (r.rows[0].CNT > 0) {
                return res.json({ existe: true, campo: 'id', mensaje: 'Este ID de cuenta ya existe.' });
            }
        }

        // ── Verificar duplicado de Nombre ─────────────────────────
        if (nombre && nombre.trim().length >= 3) {
            let sql   = `SELECT COUNT(*) AS CNT FROM CATALOGO_CUENTAS WHERE UPPER(NOMBRE) = UPPER(:nombre)`;
            const binds = { nombre: nombre.trim() };

            // En modo edición se excluye la propia cuenta para no bloquearse
            if (excludeId) {
                sql += ` AND CUENTA_ID <> :excludeId`;
                binds.excludeId = Number(excludeId);
            }

            const r = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            if (r.rows[0].CNT > 0) {
                return res.json({ existe: true, campo: 'nombre', mensaje: 'Ya existe una cuenta registrada con este nombre.' });
            }
        }

        res.json({ existe: false });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al verificar duplicados.' });
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

// ── PUT /cuentas/:id ──────────────────────────────────────────────────
// ── PUT /cuentas/:id (PORCIÓN DE INICIO OPTIMIZADA) ──
router.put('/cuentas/:id', verificarToken, async (req, res) => {
    let connection;
    try {
        const id     = req.params.id;
        const campos = normalizarCampos(req.body);
        const { NOMBRE, TIPO_SALDO, CLASIFICACION_HOJA, RUBRO, SUB_RUBRO, ESTADO } = campos;

        // Extraemos NUM_REFERENCIA directo del body (permitiendo letras/guiones nativos)
        const NUM_REFERENCIA = req.body.NUM_REFERENCIA ? String(req.body.NUM_REFERENCIA).trim() : null;
        const idString = String(id).trim();

        const faltantes = ['NOMBRE', 'TIPO_SALDO', 'CLASIFICACION_HOJA', 'RUBRO', 'SUB_RUBRO', 'ESTADO']
            .filter((k) => !campos[k]);
        if (faltantes.length > 0) {
            return res.status(400).json({
                message: 'Campos obligatorios faltantes.',
                errores: faltantes.map((f) => `[REQUERIDO] "${f}" es obligatorio.`),
            });
        }

        // REQ 3 — Validación de nombre mínimo también en edición
        if (campos.NOMBRE.trim().length < 3) {
            return res.status(400).json({
                message: 'Nombre inválido.',
                errores: ['[NOMBRE] El nombre de la cuenta es inválido o demasiado corto (mínimo 3 caracteres).'],
            });
        }

        // NUEVA VALIDACIÓN: Obligar referencia si la cuenta pertenece al rubro de bancos (1-10 o 110)
        const esCuentaDeBanco = 
            (idString.startsWith('1-10') && idString.replace(/[- ]/g, '').length === 5) || 
            (idString.startsWith('110') && idString.replace(/[- ]/g, '').length === 5);

        if (esCuentaDeBanco && (!NUM_REFERENCIA || NUM_REFERENCIA === '')) {
            return res.status(400).json({
                message: 'Falta número de referencia.',
                errores: ['[BANCOS] El campo "Número de Referencia / Cuenta Bancaria" es obligatorio para este nivel de detalle disponible.'],
            });
        }

        const errores = validarCompleto(campos);
        if (errores.length > 0) {
            return res.status(400).json({ message: 'Error de coherencia contable.', errores });
        }

                // BUSCA TU connection.execute DE UPDATE Y REEMPLÁZALO POR ESTE:
        connection = await getConnection();

        const result = await connection.execute(
            `UPDATE CATALOGO_CUENTAS
             SET NOMBRE             = :NOMBRE,
                 TIPO_SALDO         = :TIPO_SALDO,
                 CLASIFICACION_HOJA = :CLASIFICACION_HOJA,
                 RUBRO              = :RUBRO,
                 SUB_RUBRO          = :SUB_RUBRO,
                 ESTADO             = :ESTADO,
                 NUM_REFERENCIA     = :NUM_REFERENCIA
             WHERE CUENTA_ID = :id`,
            { 
                NOMBRE, 
                TIPO_SALDO, 
                CLASIFICACION_HOJA, 
                RUBRO, 
                SUB_RUBRO, 
                ESTADO, 
                // Si es cuenta de banco guarda el string, si no, setea NULL limpio en Oracle Cloud
                NUM_REFERENCIA: esCuentaDeBanco ? NUM_REFERENCIA : null, 
                id 
            },
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

// ── DELETE /cuentas/:id ───────────────────────────────────────────────
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
            {
                USER_ID:        req.usuario?.ID || null,
                ACCION:         'DELETE',
                TABLA_AFECTADA: 'CATALOGO_CUENTAS',
                REGISTRO_ID:    id,
            },
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
