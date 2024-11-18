import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDB } from '../db';
import { teachers } from '../db/schema';

const router = new Hono();

const teacherSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(2)
});

// Get all teachers
router.get('/', async (c) => {
  const db = createDB(c.env.DB);
  const results = await db.select().from(teachers).orderBy(teachers.createdAt);
  return c.json(results);
});

// Get teacher by ID
router.get('/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const result = await db
    .select()
    .from(teachers)
    .where(eq(teachers.id, id))
    .get();
  
  if (!result) return c.json({ error: 'Teacher not found' }, 404);
  return c.json(result);
});

// Create teacher
router.post('/', zValidator('json', teacherSchema), async (c) => {
  const db = createDB(c.env.DB);
  const data = await c.req.json();
  
  try {
    const result = await db.insert(teachers).values(data);
    await c.env.CACHE.delete('/api/teachers');
    return c.json({ message: 'Teacher created successfully', id: result.lastID }, 201);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    throw error;
  }
});

// Update teacher
router.put('/:id', zValidator('json', teacherSchema), async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  const data = await c.req.json();

  const result = await db
    .update(teachers)
    .set(data)
    .where(eq(teachers.id, id));

  if (!result.changes) return c.json({ error: 'Teacher not found' }, 404);
  
  await c.env.CACHE.delete('/api/teachers');
  await c.env.CACHE.delete(`/api/teachers/${id}`);
  return c.json({ message: 'Teacher updated successfully' });
});

// Delete teacher
router.delete('/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const result = await db
    .delete(teachers)
    .where(eq(teachers.id, id));

  if (!result.changes) return c.json({ error: 'Teacher not found' }, 404);
  
  await c.env.CACHE.delete('/api/teachers');
  await c.env.CACHE.delete(`/api/teachers/${id}`);
  return c.json({ message: 'Teacher deleted successfully' });
});

export { router as teacherRoutes };