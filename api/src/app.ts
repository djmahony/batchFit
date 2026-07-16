import cors from 'cors';
import express from 'express';

import { errorHandler } from './errorHandler.js';
import { authRouter } from './routes/auth.js';
import { batchesRouter } from './routes/batches.js';
import { diaryRouter } from './routes/diary.js';
import { exercisesRouter } from './routes/exercises.js';
import { foodsRouter } from './routes/foods.js';
import { meRouter } from './routes/me.js';
import { recipesRouter } from './routes/recipes.js';
import { toolsRouter } from './routes/tools.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'batchfit-api' });
});

app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/tools', toolsRouter);
app.use('/foods', foodsRouter);
app.use('/diary', diaryRouter);
app.use('/batches', batchesRouter);
app.use('/recipes', recipesRouter);
app.use('/exercises', exercisesRouter);

app.use(errorHandler);
