import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

// Create version info
const versionInfo = {
  version: version,
  timestamp: new Date().toISOString(),
  buildDate: new Date().toISOString().split('T')[0]
};

// Write to public/version.json
const versionPath = path.join('./public', 'version.json');
fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));

console.log(`Updated version.json with version: ${version}`);
console.log(`Timestamp: ${versionInfo.timestamp}`);