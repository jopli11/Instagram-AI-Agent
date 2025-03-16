import mongoose from 'mongoose';
import logger from './logger';

export const connectDB = async () => {
  // Skip MongoDB connection if MONGODB_URI is not provided
  if (!process.env.MONGODB_URI) {
    logger.warn('MONGODB_URI not provided. Running without database connection.');
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      // These options are no longer necessary
    });
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    // Don't exit the process, just log the error
    logger.warn('Continuing without database connection');
  }
};
