import express, { Application, Request, Response, NextFunction } from 'express';
import caseBundleRouter from './routes/caseBundle';
import orthancRouter from './routes/orthanc';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/case-bundle', caseBundleRouter);
app.use('/api/orthanc', orthancRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Veterinary DICOM API',
    endpoints: [
      'GET /api/case-bundle/:studyInstanceUid',
      'GET /api/orthanc/series/:studyInstanceUid',
    ],
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET /api/case-bundle/:studyInstanceUid');
  console.log('  GET /api/orthanc/series/:studyInstanceUid');
});

export default app;
