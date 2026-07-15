import type { ErrorRequestHandler } from 'express';

// Catch-all for errors that escape a route handler (Express 5 forwards rejected
// async handlers here). Logs the error and returns a generic 500 so a DB hiccup
// never leaks internals — or, pre-Express-5, killed the process as an unhandled
// rejection.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong' });
};
