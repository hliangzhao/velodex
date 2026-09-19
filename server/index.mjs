import { createApp } from './app.mjs';
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = createApp(undefined, { production: process.env.NODE_ENV === 'production' }).listen(
  port,
  host,
  () => console.log(`VÉLODEX API: http://${host}:${port}`),
);
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
