// Server entry point for production use
const fs = require('fs');
const path = require('path');
const { app, server, setupDatabase, startHeartbeat, config } = require('./app');

// Cleanup function to remove old audio files - improved with async operations
async function cleanupOldAudioFiles() {
  const audioDir = path.join(config.dataDir, 'audio');
  
  try {
    // Check if directory exists using async fs operations
    try {
      await fs.promises.access(audioDir);
    } catch (error) {
      // Directory doesn't exist, nothing to clean up
      if (config.logLevel === 'debug') {
        console.log(`Audio directory does not exist: ${audioDir}`);
      }
      return;
    }
    
    const cutoffTime = Date.now() - (config.retainAudioHours * 60 * 60 * 1000);
    
    if (config.logLevel === 'debug' || config.logLevel === 'info') {
      console.log(`Starting audio cleanup, removing files older than ${config.retainAudioHours} hours`);
    }
    
    // Read all device directories with async fs
    const deviceDirs = await fs.promises.readdir(audioDir);
    
    // Process each device directory
    const devicePromises = deviceDirs.map(async (deviceDir) => {
      const devicePath = path.join(audioDir, deviceDir);
      
      try {
        // Get directory stats async
        const dirStats = await fs.promises.stat(devicePath);
        
        if (!dirStats.isDirectory()) {
          return;
        }
        
        // Get files in device directory
        const files = await fs.promises.readdir(devicePath);
        
        // Delete old files in batches to avoid overwhelming the file system
        const batchSize = 20;
        const batches = [];
        
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          batches.push(batch);
        }
        
        // Process each batch sequentially
        for (const batch of batches) {
          await Promise.all(batch.map(async (file) => {
            const filePath = path.join(devicePath, file);
            
            try {
              const stats = await fs.promises.stat(filePath);
              
              // Delete files older than the cutoff time
              if (stats.mtimeMs < cutoffTime) {
                await fs.promises.unlink(filePath);
                if (config.logLevel === 'debug') {
                  console.log(`Deleted old audio file: ${filePath}`);
                }
              }
            } catch (fileError) {
              console.error(`Error processing file ${filePath}:`, fileError);
            }
          }));
        }
        
        // Check if the device directory is now empty and delete if it is
        const remainingFiles = await fs.promises.readdir(devicePath);
        if (remainingFiles.length === 0) {
          try {
            await fs.promises.rmdir(devicePath);
            console.log(`Removed empty device directory: ${devicePath}`);
          } catch (rmdirError) {
            console.error(`Error removing empty directory ${devicePath}:`, rmdirError);
          }
        }
      } catch (deviceError) {
        console.error(`Error processing device directory ${devicePath}:`, deviceError);
      }
    });
    
    // Wait for all device directories to be processed
    await Promise.all(devicePromises);
    
    if (config.logLevel === 'debug' || config.logLevel === 'info') {
      console.log('Audio cleanup completed');
    }
  } catch (error) {
    console.error('Error cleaning up old audio files:', error);
  }
}

// Start the server
async function startServer() {
  try {
    // Initialize database
    await setupDatabase();
    
    // Start heartbeat mechanism for WebSocket connections
    startHeartbeat();
    
    // Schedule cleanup with configurable interval
    const cleanupIntervalMs = config.cleanupIntervalMinutes * 60 * 1000;
    setInterval(cleanupOldAudioFiles, cleanupIntervalMs);
    
    // Also run cleanup on startup, but with a delay to avoid blocking server start
    setTimeout(cleanupOldAudioFiles, 30000);
    
    // Start the server
    server.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

// Start the server
startServer();