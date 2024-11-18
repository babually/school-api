import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const router = new Hono();

const enrollmentSchema = z.object({
  studentId: z.number().positive(),
  courseId: z.number().positive()
});

// Get all enrollments
router.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.*,
           s.first_name as student_first_name,
           s.last_name as student_last_name,
           c.name as course_name
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN courses c ON e.course_id = c.id
    ORDER BY e.enrollment_date DESC
  `).all();
  return c.json(results);
});

// Get enrollments by student ID
router.get('/student/:id', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(`
    SELECT c.name as course_name,
           c.credits,
           t.first_name as teacher_first_name,
           t.last_name as teacher_last_name,
           e.enrollment_date
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE e.student_id = ?
  `).bind(id).all();
  
  return c.json(results);
});

// Create enrollment
router.post('/', zValidator('json', enrollmentSchema), async (c) => {
  const { studentId, courseId } = await c.req.json();
  
  try {
    const { success } = await c.env.DB.prepare(
      'INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)'
    ).bind(studentId, courseId).run();

    if (success) {
      await c.env.CACHE.delete('/api/enrollments');
      await c.env.CACHE.delete(`/api/enrollments/student/${studentId}`);
      return c.json({ message: 'Enrollment created successfully' }, 201);
    }
  } catch (error) {
    if (error.message.includes('FOREIGN KEY')) {
      return c.json({ error: 'Student or course not found' }, 400);
    }
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'Student already enrolled in this course' }, 400);
    }
    throw error;
  }
});

// Delete enrollment
router.delete('/', zValidator('json', enrollmentSchema), async (c) => {
  const { studentId, courseId } = await c.req.json();
  
  const { success } = await c.env.DB.prepare(
    'DELETE FROM enrollments WHERE student_id = ? AND course_id = ?'
  ).bind(studentId, courseId).run();

  if (!success) return c.json({ error: 'Enrollment not found' }, 404);
  
  await c.env.CACHE.delete('/api/enrollments');
  await c.env.CACHE.delete(`/api/enrollments/student/${studentId}`);
  return c.json({ message: 'Enrollment deleted successfully' });
});

export { router as enrollmentRoutes };