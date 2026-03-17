require('dotenv').config();
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
