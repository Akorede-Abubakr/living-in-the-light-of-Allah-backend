import mongoose from 'mongoose';
import { config } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host} (${conn.connection.name})`);
  } catch (error) {
    // Connection strings and driver exceptions can contain database passwords.
    console.error('[Database] Connection failed. Check MONGODB_URI and database network access.');
    // Do not terminate process immediately in development so server can report status
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB reconnected');
});
