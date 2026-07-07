import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

async function main() {
  await connectDatabase();

  const app = createApp();
  const port = env.PORT;

  app.listen(port, () => {
    logger.info(`CommandBridge API listening on port ${port}`, {
      env: env.NODE_ENV,
      frontend: env.FRONTEND_URL,
    });
  });
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
