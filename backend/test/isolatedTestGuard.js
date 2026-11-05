export function assertIsolatedTestTarget(baseUrl) {
  const base = new URL(baseUrl);
  if (!String(process.env.DB_NAME).startsWith('rezero_stability_') || process.env.REDIS_PORT !== '16379' || base.hostname !== '127.0.0.1' || base.port !== '18082') {
    throw new Error('Only isolated stability DB, Valkey 16379 and localhost API 18082 are allowed');
  }
}
