const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getConnection } = require('./database');

// importar rutas
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

// prueba de conexión a Oracle
app.get('/test-db', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute('SELECT SYSDATE FROM DUAL');
    res.json({ message: "Conectado a Oracle Cloud", fecha: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});