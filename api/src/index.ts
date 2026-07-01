import cors from 'cors';
import express from 'express';

import { batchesRouter } from './routes/batches.js';
import { foodsRouter } from './routes/foods.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'batchfit-api' });
});

app.use('/foods', foodsRouter);
app.use('/batches', batchesRouter);

app.listen(port, () => {
  console.log(`BatchFit API listening on http://localhost:${port}`);
});
