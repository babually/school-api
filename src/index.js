import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from './middleware/cache';
import { studentRoutes } from './routes/students';
import { teacherRoutes } from './routes/teachers';
import { courseRoutes } from './routes/courses';
import { enrollmentRoutes } from './routes/enrollments';

const app = new Hono();

app.use('/*', cors());
app.use('/*', cache);

// Mount routes
app.route('/api/students', studentRoutes);
app.route('/api/teachers', teacherRoutes);
app.route('/api/courses', courseRoutes);
app.route('/api/enrollments', enrollmentRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;