import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const router = new Hono();

const teacherSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(2)
});

// Get all teachers
router.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM teachers ORDER BY created_at DESC'
  ).all();
  return c.json(results);
});

// Get teacher by ID
router.get('/:id', async (c) => {
  const id = c.req.param('id');
  const teacher = await c.env.DB.prepare(
    'SELECT * FROM teachers WHERE id = ?'
  ).bind(id).first();
  
  if (!teacher) return c.json({ error: 'Teacher not found' }, 404);
  return c.json(teacher);
});

// Create teacher
router.post('/', zValidator('json', teacherSchema), async (c) => {
  const { firstName, lastName, email, subject } = await c.req.json();
  
  try {
    const { success } = await c.env.DB.prepare(
      'INSERT INTO teachers (first_name, last_name, email, subject) VALUES (?, ?, ?, ?)'
    ).bind(firstName, lastName, email, subject).run();

    if (success) {
      await c.env.CACHE.delete('/api/teachers');
      return c.json({ message: 'Teacher created successfully' }, 201);
    }
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    throw error;
  }
});

// Update teacher
router.put('/:id', zValidator('json', teacherSchema), async (c) => {
  const id = c.req.param('id');
  const { firstName, lastName, email, subject } = await c.req.json();

  const { success } = await c.env.DB.prepare(
    'UPDATE teachers SET first_name = ?, last_name = ?, email = ?, subject = ? WHERE id = ?'
  ).bind(firstName, lastName, email, subject, id).run();

  if (!success) return c.json({ error: 'Teacher not found' }, 404);
  
  await c.env.CACHE.delete('/api/teachers');
  await c.env.CACHE.delete(`/api/teachers/${id}`);
  return c.json({ message: 'Teacher updated successfully' });
});

// Delete teacher
router.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  const { success } = await c.env.DB.prepare(
    'DELETE FROM teachers WHERE id = ?'
  ).bind(id).run();

  if (!success) return c.json({ error: 'Teacher not found' }, 404);
  
  await c.env.CACHE.delete('/api/teachers');
  await c.env.CACHE.delete(`/api/teachers/${id}`);
  return c.json({ message: 'Teacher deleted successfully' });
});

export { router as teacherRoutes };