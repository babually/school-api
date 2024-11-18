import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createDB } from '../db';
import { enrollments, students, courses, teachers } from '../db/schema';

const router = new Hono();

const enrollmentSchema = z.object({
  studentId: z.number().positive(),
  courseId: z.number().positive()
});

// Get all enrollments
router.get('/', async (c) => {
  const db = createDB(c.env.DB);
  const results = await db
    .select({
      studentId: enrollments.studentId,
      courseId: enrollments.courseId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      courseName: courses.name,
      enrollmentDate: enrollments.enrollmentDate
    })
    .from(enrollments)
    .leftJoin(students, eq(enrollments.studentId, students.id))
    .leftJoin(courses, eq(enrollments.courseId, courses.id))
    .orderBy(enrollments.enrollmentDate);
    
  return c.json(results);
});

// Get enrollments by student ID
router.get('/student/:id', async (c) => {
  const db = createDB(c.env.DB);
  const id = Number(c.req.param('id'));
  
  const results = await db
    .select({
      courseName: courses.name,
      credits: courses.credits,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
      enrollmentDate: enrollments.enrollmentDate
    })
    .from(enrollments)
    .leftJoin(courses, eq(enrollments.courseId, courses.id))
    .leftJoin(teachers, eq(courses.teacherId, teachers.id))
    .where(eq(enrollments.studentId, id))
    .orderBy(enrollments.enrollmentDate);
    
  return c.json(results);
});

// Create enrollment
router.post('/', zValidator('json', enrollmentSchema), async (c) => {
  const db = createDB(c.env.DB);
  const data = await c.req.json();
  
  try {
    const result = await db.insert(enrollments).values(data);
    await c.env.CACHE.delete('/api/enrollments');
    await c.env.CACHE.delete(`/api/enrollments/student/${data.studentId}`);
    return c.json({ message: 'Enrollment created successfully' }, 201);
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
  const db = createDB(c.env.DB);
  const { studentId, courseId } = await c.req.json();
  
  const result = await db
    .delete(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.courseId, courseId)
      )
    );

  if (!result.changes) return c.json({ error: 'Enrollment not found' }, 404);
  
  await c.env.CACHE.delete('/api/enrollments');
  await c.env.CACHE.delete(`/api/enrollments/student/${studentId}`);
  return c.json({ message: 'Enrollment deleted successfully' });
});

export { router as enrollmentRoutes };