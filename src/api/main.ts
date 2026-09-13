import { createDefaultApiServer } from './composition';

const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const api = createDefaultApiServer();
const shutdown = (): void => {
  api.server.close(() => api.close());
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

api.server.listen(port, () => {
  console.log(`YUNELA API listening on port ${port}`);
});
