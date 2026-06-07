const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

function getConnection() {
  return process.env.DATABASE_URL;
}

module.exports = {
  client: 'pg',
  connection: getConnection(),
  migrations: {
    directory: './migrations',
  },
};
