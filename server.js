require('dotenv').config();
const dns = require('dns');
// Gmail SMTP often resolves to IPv6 first; Render outbound IPv6 can fail (ENETUNREACH).
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const app = require('./app');
const connectDB = require('./config/database');
const { createDefaultAdmin } = require('./modules/model/adminModel');
const { ensureNutritionCheatSheetSeed } = require('./modules/service/nutritionCheatSheetSeed');
const { ensureStretchProgramSeed } = require('./modules/service/stretchProgramSeed');
const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => createDefaultAdmin())
  .then(() => ensureNutritionCheatSheetSeed().catch((e) => console.error('Nutrition cheat sheet seed:', e.message)))
  .then(() => ensureStretchProgramSeed().catch((e) => console.error('Stretch program seed:', e.message)))
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server: http://localhost:${PORT}`);
    });
  });
