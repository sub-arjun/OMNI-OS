#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function getUpdateCachePath() {
  const platform = process.platform;
  const appName = 'OMNI';
  
  let basePath;
  
  switch (platform) {
    case 'win32':
      basePath = path.join(process.env.APPDATA || '', appName);
      break;
    case 'darwin':
      basePath = path.join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    case 'linux':
      basePath = path.join(os.homedir(), '.config', appName);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  
  return path.join(basePath, 'pending-updates');
}

function clearUpdateCache() {
  try {
    const cachePath = getUpdateCachePath();
    
    console.log(`Clearing update cache at: ${cachePath}`);
    
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
      console.log('✅ Update cache cleared successfully!');
      console.log('You can now restart OMNI to try updating again.');
    } else {
      console.log('ℹ️  No update cache found. Nothing to clear.');
    }
  } catch (error) {
    console.error('❌ Error clearing update cache:', error.message);
    console.log('Please try running this script as administrator/sudo or manually delete the cache folder.');
  }
}

function main() {
  console.log('🧹 OMNI Update Cache Cleaner');
  console.log('This script will clear the update cache to resolve update issues.\n');
  
  clearUpdateCache();
}

if (require.main === module) {
  main();
}

module.exports = { clearUpdateCache, getUpdateCachePath }; 