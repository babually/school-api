import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDB } from '../db';
import { courses, teachers } from '../db/schema';

const router = new Hono();

const courseSchema = z.object({
  name: z.string().min(2),
  teacherId: z.number().positive(),
  credits: z.number().min(1).max(6)
});

// Get all courses
router.get('/', async (c) => {
  const db = createDB(c.env.DB);
  const results = await db
    .select({
      id: courses.id,
      name: courses.name,
      credits: courses.credits,
      teacherId: courses.teacherId,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
      createdAt: courses.createdAt
    })
    .from(courses)
    .leftJoin(teachers, eq(courses.teacherId, teachers.id))
    .orderBy(courses.createdAt);
    
  return c.json(results);
});

// Get course by ID
router.get('/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const result = await db
    .select({
      id: courses.id,
      name: courses.name,
      credits: courses.credits,
      teacherId: courses.teacherId,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
      createdAt: courses.createdAt
    })
    .from(courses)
    .leftJoin(teachers, eq(courses.teacherId, teachers.id))
    .where(eq(courses.id, id))
    .get();
  
  if (!result) return c.json({ error: 'Course not found' }, 404);
  return c.json(result);
});

// Create course
router.post('/', zValidator('json', courseSchema), async (c) => {
  const db = createDB(c.env.DB);
  const data = await c.req.json();
  
  try {
    const result = await db.insert(courses).values(data);
    await c.env.CACHE.delete('/api/courses');
    return c.json({ message: 'Course created successfully', id: result.lastID }, 201);
  } catch (error) {
    if (error.message.includes('FOREIGN KEY')) {
      return c.json({ error: 'Teacher not found' }, 400);
    }
    throw error;
  }
});

// Update course
router.put('/:id', zValidator('json', courseSchema), async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  const data = await c.req.json();

  const result = await db
    .update(courses)
    .set(data)
    .where(eq(courses.id, id));

  if (!result.changes) return c.json({ error: 'Course not found' }, 404);
  
  await c.env.CACHE.delete('/api/courses');
  await c.env.CACHE.delete(`/api/courses/${id}`);
  return c.json({ message: 'Course updated successfully' });
});

// Delete course
router.delete('/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const result = await db
    .delete(courses)
    .where(eq(courses.id, id));

  if (!result.changes) return c.json({ error: 'Course not found' }, 404);
  
  await c.env.CACHE.delete('/api/courses');
  await c.env.CACHE.delete(`/api/courses/${id}`);
  return c.json({ message: 'Course deleted successfully' });
});

export { router as courseRoutes };