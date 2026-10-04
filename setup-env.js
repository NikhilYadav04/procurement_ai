const fs = require('fs');
const path = require('path');

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  console.error('Please create a .env.local file with your environment variables.');
  console.error('See .env.example for reference.');
  process.exit(1);
}

console.log('✅ Environment file found!');
