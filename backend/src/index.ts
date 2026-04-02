import 'dotenv/config';
import { app } from './app';
import { startCronJobs } from './jobs';

// On Vercel the platform handles the HTTP server — only listen locally
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🌊 Flowfy API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV ?? 'development'}`);
    startCronJobs();
  });
}

export default app;
