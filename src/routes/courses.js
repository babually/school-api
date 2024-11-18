import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const router = new Hono();

const courseSchema = z.object({
  name: z.string().min(2),
  teacherId: z.number().positive(),
  credits: z.number().min(1).max(6)
});

// Get all courses
router.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT c.*, 
           t.first_name as teacher_first_name, 
           t.last_name as teacher_last_name
    FROM courses c
    JOIN teachers t ON c.teacher_id = t.id
    ORDER BY c.created_at DESC
  `).all();
  return c.json(results);
});

// Get course by ID
router.get('/:id', async (c) => {
  const id = c.req.param('id');
  const course = await c.env.DB.prepare(`
    SELECT c.*, 
           t.first_name as teacher_first_name, 
           t.last_name as teacher_last_name
    FROM courses c
    JOIN teachers t ON c.teacher_id = t.id
    WHERE c.id = ?
  `).bind(id).first();
  
  if (!course) return c.json({ error: 'Course not found' }, 404);
  return c.json(course);
});

// Create course
router.post('/', zValidator('json', courseSchema), async (c) => {
  const { name, teacherId, credits } = await c.req.json();
  
  try {
    const { success } = await c.env.DB.prepare(
      'INSERT INTO courses (name, teacher_id, credits) VALUES (?, ?, ?)'
    ).bind(name, teacherId, credits).run();

    if (success) {
      await c.env.CACHE.delete('/api/courses');
      return c.json({ message: 'Course created successfully' }, 201);
    }
  } catch (error) {
    if (error.message.includes('FOREIGN KEY')) {
      return c.json({ error: 'Teacher not found' }, 400);
    }
    throw error;
  }
});

// Update course
router.put('/:id', zValidator('json', courseSchema), async (c) => {
  const id = c.req.param('id');
  const { name, teacherId, credits } = await c.req.json();

  const { success } = await c.env.DB.prepare(
    'UPDATE courses SET name = ?, teacher_id = ?, credits = ? WHERE id = ?'
  ).bind(name, teacherId, credits, id).run();

  if (!success) return c.json({ error: 'Course not found' }, 404);
  
  await c.env.CACHE.delete('/api/courses');
  await c.env.CACHE.delete(`/api/courses/${id}`);
  return c.json({ message: 'Course updated successfully' });
});

// Delete course
router.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  const { success } = await c.env.DB.prepare(
    'DELETE FROM courses WHERE id = ?'
  ).bind(id).run();

  if (!success) return c.json({ error: 'Course not found' }, 404);
  
  await c.env.CACHE.delete('/api/courses');
  await c.env.CACHE.delete(`/api/courses/${id}`);
  return c.json({ message: 'Course deleted successfully' });
});

export { router as courseRoutes };