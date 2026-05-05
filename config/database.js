const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/four_score';
  const retryDelayMs = Number(process.env.MONGODB_RETRY_DELAY_MS || 5000);

  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
      });

      console.log('MongoDB connected:', conn.connection.host);
      return conn;
    } catch (err) {
      console.error(
        `MongoDB connection error (attempt ${attempt}). Retrying in ${retryDelayMs}ms:`,
        err.message
      );

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
};

module.exports = connectDB;
