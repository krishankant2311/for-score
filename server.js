require('dotenv').config();
const dns = require('dns');
// Gmail SMTP often resolves to IPv6 first; Render outbound IPv6 can fail (ENETUNREACH).
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const app = require('./app');
const connectDB = require('./config/database');
const { createDefaultAdmin } = require('./modules/model/adminModel');
const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => createDefaultAdmin())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server: http://localhost:${PORT}`);
    });
  });
