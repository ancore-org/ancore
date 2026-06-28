import { createApp } from './server';
import { log } from './logging/logger';

const PORT = process.env['PORT'] ?? 3001;
const app = createApp();

app.listen(PORT, () => {
  log.info({ port: PORT }, 'ai-agent service started');
});
