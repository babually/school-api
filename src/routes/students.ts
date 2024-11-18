import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDB } from '../db';
import { students } from '../db/schema';

const router = new Hono();

const studentSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  grade: z.number().min(1).max(12)
});

// Get all students
router.get('/', async (c) => {
  const db = createDB(c.env.DB);
  const results = await db.select().from(students).orderBy(students.createdAt);
  return c.json(results);
});

// Get student by ID
router.get('/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const result = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .get();
  
  if (!result) return c.json({ error: 'Student not found' }, 404);
  return c.json(result);
});

// Create student
router.post('/', zValidator('json', studentSchema), async (c) => {
  const db = createDB(c.env.DB);
  const data = await c.req.json();
  
  try {
    const result = await db.insert(students).values(data);
    await c.env.CACHE.delete('/api/students');
    return c.json({ message: 'Student created successfully', id: result.lastID }, 201);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    throw error;
  }
});

// Update student
router.put('/:id', zValidator('json', studentSchema), async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  const data = await c.req.json();

  const result = await db
    .update(students)
    .set(data)
    .where(eq(students.id, id));

  if (!result.changes) return c.json({ error: 'Student not found' }, 404);
  
  await c.env.CACHE.delete('/api/students');
  await c.env.CACHE.delete(`/api/students/${id}`);
  return c.json({ message: 'Student updated successfully' });
});

// Delete student
router.delete('/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const result = await db
    .delete(students)
    .where(eq(students.id, id));

  if (!result.changes) return c.json({ error: 'Student not found' }, 404);
  
  await c.env.CACHE.delete('/api/students');
  await c.env.CACHE.delete(`/api/students/${id}`);
  return c.json({ message: 'Student deleted successfully' });
});

export { router as studentRoutes };