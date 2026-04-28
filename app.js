const express = require('express');
const cors = require('cors');
const path = require('path');
const userRoute = require('./modules/route/userRoute');
const adminRoute = require('./modules/route/adminRoute');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/user', userRoute);
app.use('/api/admin', adminRoute);

module.exports = app;
