const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer;

const connectWithUri = async (uri, label) => {
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected (${label}): ${conn.connection.host}`);
};

const tryConnect = async (uri, label) => {
  try {
    await connectWithUri(uri, label);
    return true;
  } catch (error) {
    console.log(`${label} not available (${error.message})`);
    return false;
  }
};

const startPersistedMemoryDb = async () => {
  const dbPath = path.join(__dirname, '..', 'data', 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });

  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'fintrack',
      dbPath,
      storageEngine: 'wiredTiger'
    }
  });

  await connectWithUri(memoryServer.getUri(), 'local files');
};

const connectDB = async () => {
  try {
    // Never silently fall back to a local database in production: this could
    // make users see missing data after a connection failure.
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required in production');
      }
      await connectWithUri(process.env.MONGODB_URI, 'production');
      return;
    }

    if (process.env.MONGODB_URI) {
      if (await tryConnect(process.env.MONGODB_URI, 'MONGODB_URI')) return;
    } else if (await tryConnect('mongodb://127.0.0.1:27017/fintrack', 'local MongoDB')) {
      return;
    }

    console.log('Using a file-backed local database so signup works without installing MongoDB.');
    await startPersistedMemoryDb();
  } catch (error) {
    console.error(`Could not connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
