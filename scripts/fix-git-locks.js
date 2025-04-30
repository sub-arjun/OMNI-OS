const fs = require('fs');
const path = require('path');

/**
 * Script to handle Git lock files that might cause errors
 * Especially useful for fixing EPERM maintenance.lock errors
 */

// Define the paths to check and potentially delete
const lockPaths = [
  '.git/objects/maintenance.lock',
  '.git/index.lock'
];

// Root directory
const rootDir = path.resolve(__dirname, '..');

console.log('Checking for Git lock files...');

lockPaths.forEach(lockPath => {
  const fullPath = path.join(rootDir, lockPath);
  
  try {
    // Check if the file exists
    if (fs.existsSync(fullPath)) {
      console.log(`Found lock file: ${lockPath}`);
      
      try {
        // Try to remove read-only attribute first (Windows specific)
        if (process.platform === 'win32') {
          const { execSync } = require('child_process');
          execSync(`attrib -r "${fullPath}"`);
          console.log(`Removed read-only attribute from ${lockPath}`);
        }
        
        // Delete the file
        fs.unlinkSync(fullPath);
        console.log(`Successfully deleted: ${lockPath}`);
      } catch (deleteErr) {
        console.error(`Error deleting ${lockPath}:`, deleteErr.message);
        console.log('You might need to run this script with higher privileges or close any applications using Git.');
      }
    } else {
      console.log(`Lock file not found: ${lockPath}`);
    }
  } catch (err) {
    console.error(`Error checking ${lockPath}:`, err.message);
  }
});

console.log('Done checking for Git lock files.'); 