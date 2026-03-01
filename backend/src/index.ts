import 'dotenv/config';
import { app } from './app';
import { startCronJobs } from './jobs';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🌊 Flowfy API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV ?? 'development'}`);
  startCronJobs();
});

export default app;
