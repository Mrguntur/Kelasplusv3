// cPanel Passenger startup shim.
// The cPanel Node.js Application URL is mounted at /api/v1, so set
// API_GLOBAL_PREFIX="" in the application's environment variables.
import('./dist/main.js').catch((error) => {
  console.error('KELAS+ Platform V2 API failed to start:', error);
  process.exit(1);
});
