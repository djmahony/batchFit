import cors from 'cors';
import express from 'express';

import { batchesRouter } from './routes/batches.js';
import { foodsRouter } from './routes/foods.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'batchfit-api' });
});

app.use('/foods', foodsRouter);
app.use('/batches', batchesRouter);
