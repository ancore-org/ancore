/**
 * app.ts
 *
 * Re-exports the Express application factory for relayer service consumers.
 */

export { createApp } from './server';
import express, { type Application } from 'express';
import { requestIdMiddleware } from './middleware/requestId';

const app: Application = express();

// Register request ID middleware early in the chain to ensure it's available for all subsequent middleware and routes.
app.use(requestIdMiddleware);

// Example of other middleware and routes (uncomment and adapt as needed)
// app.use(express.json());
// app.get('/health', (req, res) => {
//   logger.info('Health check requested', { path: req.path });
//   res.status(200).send('OK');
// });

export default app;
