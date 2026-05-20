const mongoose = require('mongoose');

const toBool = (value) => String(value).toLowerCase() === 'true';

/**
 * Old index: unique + sparse still indexed googleId "", causing E11000 for any User.save().
 * Replace with partial unique (non-empty googleId only). Safe to call on each boot.
 */
const migrateUserGoogleIdIndex = async () => {
  try {
    const User = require('../modules/model/userModel');
    const coll = User.collection;
    const specs = await coll.indexes();
    const idx = specs.find((x) => x.name === 'googleId_1');
    if (
      idx &&
      (!idx.partialFilterExpression || Object.keys(idx.partialFilterExpression).length === 0)
    ) {
      await coll.dropIndex('googleId_1');
    }
    await User.syncIndexes();
  } catch (e) {
    console.warn('User googleId index migration (non-fatal):', e.message);
  }
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/four_score';
  const retryDelayMs = Number(process.env.MONGODB_RETRY_DELAY_MS || 5000);
  const allowInvalidCerts = toBool(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS);

  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        tlsAllowInvalidCertificates: allowInvalidCerts,
      });

      console.log('MongoDB connected:', conn.connection.host);
      await migrateUserGoogleIdIndex();
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
