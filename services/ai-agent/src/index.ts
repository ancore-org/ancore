import { createApp } from './server';

const PORT = process.env['PORT'] ?? 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      time: new Date().toISOString(),
      msg: 'ai-agent service started',
      port: PORT,
    })
  );
});
