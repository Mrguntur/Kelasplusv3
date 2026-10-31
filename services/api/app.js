// cPanel Passenger startup shim.
// Register the cPanel Node.js Application URL at /api/v1.
// Keep API_GLOBAL_PREFIX=api/v1 (the default) to match the public route.
import('./dist/main.js').catch((error) => {
  console.error('KELAS+ Platform V2 API failed to start:', error);
  process.exit(1);
});
