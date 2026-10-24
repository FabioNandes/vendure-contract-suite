import { bootstrapWorker } from '@vendure/core';
import { assertEnv, config } from './vendure-config';

assertEnv();

bootstrapWorker(config)
  .then((worker) => worker.startJobQueue())
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
