/**
 * Test infrastructure helper
 *
 * Exports connect() and disconnect() to be called from beforeAll/afterAll
 * in every test file. Each test file gets an isolated, ephemeral in-memory
 * MongoDB instance — nothing is shared with the development database.
 *
 * Usage in a test file:
 *
 *   const { connect, disconnect, clearDatabase } = require('./setup');
 *   beforeAll(connect);
 *   afterAll(disconnect);
 *   afterEach(clearDatabase);   // optional: wipe collections between tests
 */

'use strict';

const crypto   = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set the test environment flags before any application code can run.
// server.js checks NODE_ENV to decide whether to allow dotenv to override
// pre-set env vars. These must be in place before the first require('./server').
process.env.NODE_ENV    = 'test';

// Generate a cryptographically random JWT secret for this test process.
// The server's startup guard accepts any value that is:
//   - non-empty
//   - not in the KNOWN_WEAK_SECRETS list
// A 'test-' prefix followed by 32 random bytes meets both conditions.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('test-')) {
  process.env.JWT_SECRET    = 'test-' + crypto.randomBytes(32).toString('hex');
  process.env.JWT_EXPIRES_IN = '1h';
}

let mongoServer = null;

/**
 * Start an ephemeral in-memory MongoDB, connect Mongoose to it, then return.
 * Call from beforeAll(). Safe to call multiple times (idempotent).
 */
async function connect() {
  if (mongoServer) return; // already connected

  // MongoMemoryServer manages its own temporary directory under the OS temp folder.
  // No dbPath is specified here, so MMS creates a unique temp dir per instance and
  // removes it when stop() is called — leaving no permanent files behind.
  // Note: 'ephemeralForTest' was removed in MongoDB 7.0; MMS uses 'wiredTiger' by
  // default which is equivalent for test purposes when paired with its auto-cleanup.
  mongoServer = await MongoMemoryServer.create();

  const uri = mongoServer.getUri();

  // If mongoose is already connected (e.g. from a previous test file in the same
  // worker), disconnect first before reconnecting to the new test instance.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // This is a disposable, standalone IPv4 loopback server. Avoid topology
  // discovery and fail explicitly before Jest's suite-wide timeout.
  try {
    await mongoose.connect(uri, {
      // NODE-7832: Jest lacks the dynamic-import callback used by MongoDB
      // driver >=7.6 when resolving its default OS runtime adapter.
      // Supply Node's actual OS module explicitly; keep real handshake and DB.
      runtimeAdapters: { os: require('node:os') },
      directConnection: true,
      family: 4,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 5000
    });
    await mongoose.connection.db.admin().ping();
  } catch (error) {
    console.error('Isolated MongoDB connection failed:', error.name, error.message);
    await disconnect();
    throw error;
  }
}

/**
 * Disconnect Mongoose and stop the MongoMemoryServer.
 * Call from afterAll(). Safe if connect() was never called.
 */
async function disconnect() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Drop all documents from every collection without dropping the collections
 * themselves. Call from afterEach() to keep tests independent.
 */
async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, disconnect, clearDatabase };
