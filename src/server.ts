import express from 'express';
import cors from 'cors';
import cron from "node-cron";
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import 'dotenv/config';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import connectDB from './config/database.js';
import apiRoutes from './routes/index.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH"]
  }
});

// Logging middleware with Morgan
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-razorpay-signature"],
}));

// Capture raw body for webhook HMAC signature verification while parsing JSON
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (optional, can be toggled via env)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
// app.use(limiter);

// Static uploads folder
app.use('/uploads', express.static('uploads'));

// Base health route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'MaidEazy Backend API Server',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// API Routes
app.use('/api', apiRoutes);

// Error handling middleware (must be registered after routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(' Failed to start server:', (error as Error).message);
    process.exit(1);
  }
}

startServer();
