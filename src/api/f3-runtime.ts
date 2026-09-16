import { createDefaultF3ApiServer } from './f3-composition';

const secret = process.env.YUNELA_AUTH_SECRET;
if (!secret || secret.length < 32) {
  console.error('YUNELA_AUTH_SECRET must contain at least 32 characters in production');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535');
  process.exit(1);
}

const host = process.env.HOST ?? '0.0.0.0';
const { server, close } = createDefaultF3ApiServer();

const shutdown = (): void => {
  server.close(() => close());
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

server.listen(port, host, () => {
  console.log(`YUNELA F3 API listening on ${host}:${port}`);
});
