const oracledb = require('oracledb');
require('dotenv').config();

// Configuración de Oracle Instant Client
try {
  oracledb.initOracleClient({ 
    libDir: 'C:\\oracle\\instantclient-basic-windows.x64-23.26.1.0.0\\instantclient_23_0', 
    configDir: './wallet' 
  });
} catch (err) {
  console.error('Error al inicializar Instant Client:', err);
}

// Crear el Pool de conexiones al arrancar
async function initialize() {
  try {
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING,
      poolMin: 2,    // Mantener 2 conexiones siempre abiertas y listas
      poolMax: 10,   // Máximo de 10 personas usando la DB a la vez
      poolIncrement: 1
    });
    console.log("Pool de conexiones a Oracle creado correctamente.");
  } catch (err) {
    console.error("Error al crear el pool:", err);
  }
}

// Esta función ahora es mucho más rápida porque toma una conexión del pool
async function getConnection() {
  return await oracledb.getConnection();
}

// Exportamos initialize para que el index.js lo use al inicio
module.exports = { getConnection, initialize };
