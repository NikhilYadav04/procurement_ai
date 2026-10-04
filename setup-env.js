const fs = require('fs');
const path = require('path');

// On Vercel (and other CI platforms), env vars are injected via the dashboard.
// Skip the .env.local file check entirely in those environments.
if (process.env.VERCEL || process.env.CI) {
  console.log('✅ Running on Vercel/CI — environment variables injected via platform.');
  process.exit(0);
}

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  console.error('Please create a .env.local file with your environment variables.');
  console.error('See .env.example for reference.');
  process.exit(1);
}

console.log('✅ Environment file found!');
