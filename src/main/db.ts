// Add a wrapper function for database operations to handle file system errors

/**
 * Wrapper function to handle potential file system errors when performing database operations
 * @param operation The database operation function to execute
 * @param maxRetries Maximum number of retry attempts
 * @param delay Delay between retries in milliseconds
 * @returns The result of the operation or throws an error after max retries
 */
const withFileSystemErrorHandling = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a file system permission error
      if (
        error &&
        (error as any).code === 'EPERM' || 
        (error as any).code === 'EBUSY' || 
        (error as any).errno === -4048
      ) {
        console.warn(`File system error (attempt ${attempt + 1}/${maxRetries}):`, error);
        
        // On Windows, try to run the fix-git-locks script if it's a Git-related error
        if (
          process.platform === 'win32' &&
          (error as any).path &&
          ((error as any).path as string).includes('.git')
        ) {
          try {
            const { execSync } = require('child_process');
            console.log('Attempting to fix Git locks...');
            execSync('node scripts/fix-git-locks.js');
          } catch (scriptError) {
            console.error('Failed to run fix-git-locks script:', scriptError);
          }
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If we've exhausted all retries
  throw new Error(`Operation failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
};

// Export the wrapper function to be used with database operations
export { withFileSystemErrorHandling }; 