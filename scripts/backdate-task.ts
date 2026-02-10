// Script to backdate task completion for testing FixScore
import { db } from '../src/server/db';

const TASK_ID = 'd2178dfe-031d-4c4d-be98-de33aa5780ff';
const NEW_COMPLETION_DATE = new Date('2026-01-10T12:00:00.000Z');

async function backdateTask() {
  console.log('Updating task completion date...');
  console.log('Task ID:', TASK_ID);
  console.log('New completion date:', NEW_COMPLETION_DATE.toISOString());
  
  const task = await db.task.update({
    where: { id: TASK_ID },
    data: { completedAt: NEW_COMPLETION_DATE },
    select: { id: true, title: true, completedAt: true },
  });
  
  console.log('Updated:', task);
  
  // Calculate the periods
  const preStart = new Date(NEW_COMPLETION_DATE);
  preStart.setDate(preStart.getDate() - 30);
  const postEnd = new Date(NEW_COMPLETION_DATE);
  postEnd.setDate(postEnd.getDate() + 30);
  
  console.log('\nNew periods:');
  console.log('Pre-period:', preStart.toISOString().split('T')[0], 'to', NEW_COMPLETION_DATE.toISOString().split('T')[0]);
  console.log('Post-period:', NEW_COMPLETION_DATE.toISOString().split('T')[0], 'to', postEnd.toISOString().split('T')[0]);
  console.log('\nJan 28-29 reviews will now be in the POST period!');
}

backdateTask()
  .catch(console.error)
  .finally(() => db.$disconnect());
