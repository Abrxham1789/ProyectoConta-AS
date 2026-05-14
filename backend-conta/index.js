const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log("--- CHEQUEO DE VARIABLES ---");
console.log("Variable PORT:", process.env.PORT);
console.log("Variable USER:", process.env.DB_USER);
console.log("Ruta Oracle:", process.env.ORACLE_LIB_DIR);
console.log("----------------------------");

const { getConnection, initialize } = require('./database');
const oracledb = require('oracledb');
// importar rutas
const reportesRoutes = require('./routes/reportes');
const cuentasRoutes = require('./routes/catalogo_cuentas');
const periodosRoutes = require('./routes/periodos_cierre');
const polizasCabeceraRoutes = require('./routes/polizas_cabecera');
const polizasDetalleRoutes = require('./routes/polizas_detalle');
const configuracionReportesRoutes = require('./routes/configuracion_reportes');
const hojaTrabajoRoutes = require('./routes/hoja_trabajo_saldos');
const usuariosRoutes = require('./routes/usuarios_contables');
const logsRoutes = require('./routes/logs_auditoria');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// usar rutas
app.use('/api', reportesRoutes);
app.use('/api', cuentasRoutes);
app.use('/api', periodosRoutes);
app.use('/api', polizasCabeceraRoutes);
app.use('/api', polizasDetalleRoutes);
app.use('/api', configuracionReportesRoutes);
app.use('/api', hojaTrabajoRoutes);
app.use('/api', usuariosRoutes);
app.use('/api', logsRoutes);

// ruta base
app.get('/', (req, res) => {
  res.send('Servidor de Contabilidad funcionando');
});

// Prueba de conexión a Oracle
// Prueba de conexión modificada para auditar tu tabla de usuarios en Oracle Cloud
app.get('/test-db', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    // Le pedimos a Oracle que nos muestre cómo están guardadas las credenciales de admin
    const result = await connection.execute(
      `SELECT USERNAME, PASSWORD_HASH, ROL FROM USUARIOS_CONTABLES WHERE USERNAME = 'admin'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ 
      message: "Auditoría de credenciales en Oracle Cloud", 
      registroEncontrado: result.rows 
    });
  } catch (err) {
    console.error("Error en /test-db:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (closeErr) { console.error(closeErr); }
    }
  }
});


// NUEVA FORMA DE ARRANCAR: 
// Primero inicializamos el Pool, luego levantamos el servidor.
async function startServer() {
  try {
    await initialize(); // Llama a la función de database.js

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("No se pudo iniciar el servidor debido a un error en el Pool:", err);
    process.exit(1);
  }
}

// Mantener el pool activo con ping cada 4 minutos
setInterval(async () => {
    let connection;
    try {
        connection = await getConnection();
        await connection.execute('SELECT 1 FROM DUAL');
    } catch (err) {
        console.log('Keep-alive error:', err.message);
    } finally {
        if (connection) await connection.close();
    }
}, 240000);

startServer();


