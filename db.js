const mongoose = require('mongoose');
const dns = require('dns');

// Use Google/Cloudflare DNS to ensure SRV record resolution works on Windows
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

let connected = false;

async function connectDB() {
  if (connected) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      family: 4,
    });
    connected = true;
    console.log('  MongoDB: connected');
  } catch (err) {
    console.error('  MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
