const oracledb = require('oracledb');
require('dotenv').config();

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient-basic-windows.x64-23.26.1.0.0\\instantclient_23_0', configDir: './/wallet' });
} catch (err) {
  console.error('Error al inicializar Instant Client:', err);
}

async function getConnection() {
  return await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING,
    externalAuth: false
  });
}

module.exports = { getConnection };
