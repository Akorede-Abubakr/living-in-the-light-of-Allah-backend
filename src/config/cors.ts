import type { CorsOptions } from 'cors';

export function createCorsOptions(nodeEnv: string, frontendUrl: string, adminUrl: string): CorsOptions {
  const approved = [frontendUrl, adminUrl];
  if (nodeEnv === 'production') {
    for (const value of approved) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.origin !== value || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        throw new Error('Production FRONTEND_URL and ADMIN_URL must be exact HTTPS origins without trailing slashes.');
      }
    }
  } else {
    approved.push('http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174');
  }
  const allowed = new Set(approved);
  return {
    origin: (origin, callback) => {
      // Non-browser health checks and service calls do not send an Origin.
      if (!origin || allowed.has(origin)) return callback(null, true);
      callback(Object.assign(new Error('Origin is not approved.'), { statusCode: 403 }));
    },
    credentials: true,
  };
}
