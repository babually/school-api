import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const router = new Hono();

const studentSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  grade: z.number().min(1).max(12)
});

// Get all students
router.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM students ORDER BY created_at DESC'
  ).all();
  return c.json(results);
});

// Get student by ID
router.get('/:id', async (c) => {
  const id = c.req.param('id');
  const student = await c.env.DB.prepare(
    'SELECT * FROM students WHERE id = ?'
  ).bind(id).first();
  
  if (!student) return c.json({ error: 'Student not found' }, 404);
  return c.json(student);
});

// Create student
router.post('/', zValidator('json', studentSchema), async (c) => {
  const { firstName, lastName, email, grade } = await c.req.json();
  
  try {
    const { success } = await c.env.DB.prepare(
      'INSERT INTO students (first_name, last_name, email, grade) VALUES (?, ?, ?, ?)'
    ).bind(firstName, lastName, email, grade).run();

    if (success) {
      await c.env.CACHE.delete('/api/students');
      return c.json({ message: 'Student created successfully' }, 201);
    }
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    throw error;
  }
});

// Update student
router.put('/:id', zValidator('json', studentSchema), async (c) => {
  const id = c.req.param('id');
  const { firstName, lastName, email, grade } = await c.req.json();

  const { success } = await c.env.DB.prepare(
    'UPDATE students SET first_name = ?, last_name = ?, email = ?, grade = ? WHERE id = ?'
  ).bind(firstName, lastName, email, grade, id).run();

  if (!success) return c.json({ error: 'Student not found' }, 404);
  
  await c.env.CACHE.delete('/api/students');
  await c.env.CACHE.delete(`/api/students/${id}`);
  return c.json({ message: 'Student updated successfully' });
});

// Delete student
router.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  const { success } = await c.env.DB.prepare(
    'DELETE FROM students WHERE id = ?'
  ).bind(id).run();

  if (!success) return c.json({ error: 'Student not found' }, 404);
  
  await c.env.CACHE.delete('/api/students');
  await c.env.CACHE.delete(`/api/students/${id}`);
  return c.json({ message: 'Student deleted successfully' });
});

export { router as studentRoutes };