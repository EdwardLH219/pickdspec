/**
 * Task Service
 * 
 * Manages tasks created from recommendations.
 * Triggers FixScore calculation when tasks are completed.
 */

import { db } from '@/server/db';
import { TaskStatus, TaskPriority, RecommendationStatus, RecommendationSeverity } from '@prisma/client';
import { computeAndPersistFixScore } from '@/server/scoring/fixscore';
import { generateDraftsForTask, qualifiesForActivation } from '@/server/activations';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

export interface CreateTaskInput {
  tenantId: string;
  recommendationId?: string;
  themeId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedToId?: string;
  dueDate?: Date;
  createdById: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  notes?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignedToId?: string | null;
  dueDate?: Date | null;
  impactNotes?: string;
}

// ============================================================
// TASK OPERATIONS
// ============================================================

/**
 * Create a task (optionally from a recommendation)
 */
export async function createTask(input: CreateTaskInput) {
  // If from recommendation, get the theme and update recommendation status
  let themeId = input.themeId;
  
  if (input.recommendationId) {
    const rec = await db.recommendation.findUnique({
      where: { id: input.recommendationId },
      select: { themeId: true, status: true },
    });
    
    if (rec) {
      themeId = themeId || rec.themeId || undefined;
      
      // Update recommendation to IN_PROGRESS if it was OPEN
      if (rec.status === RecommendationStatus.OPEN) {
        await db.recommendation.update({
          where: { id: input.recommendationId },
          data: { status: RecommendationStatus.IN_PROGRESS },
        });
      }
    }
  }

  const task = await db.task.create({
    data: {
      tenantId: input.tenantId,
      recommendationId: input.recommendationId,
      themeId,
      title: input.title,
      description: input.description,
      priority: input.priority || TaskPriority.MEDIUM,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
      createdById: input.createdById,
    },
    include: {
      recommendation: { select: { id: true, title: true, severity: true } },
      theme: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  logger.info({
    taskId: task.id,
    tenantId: input.tenantId,
    recommendationId: input.recommendationId,
  }, 'Task created');

  return task;
}

/**
 * Create multiple tasks from a recommendation's suggested actions
 */
export async function createTasksFromRecommendation(
  recommendationId: string,
  createdById: string,
  options?: {
    assignedToId?: string;
    dueDaysFromNow?: number;
  }
) {
  const rec = await db.recommendation.findUnique({
    where: { id: recommendationId },
    include: { theme: true },
  });

  if (!rec) {
    throw new Error('Recommendation not found');
  }

  const suggestedActions = rec.suggestedActions as string[];
  const tasks = [];

  // Map severity to priority
  const priorityMap: Record<RecommendationSeverity, TaskPriority> = {
    [RecommendationSeverity.CRITICAL]: TaskPriority.URGENT,
    [RecommendationSeverity.HIGH]: TaskPriority.HIGH,
    [RecommendationSeverity.MEDIUM]: TaskPriority.MEDIUM,
    [RecommendationSeverity.LOW]: TaskPriority.LOW,
  };

  for (let i = 0; i < suggestedActions.length; i++) {
    const action = suggestedActions[i];
    
    // Stagger due dates
    const dueDate = options?.dueDaysFromNow
      ? new Date(Date.now() + (options.dueDaysFromNow + i * 7) * 24 * 60 * 60 * 1000)
      : undefined;

    const task = await createTask({
      tenantId: rec.tenantId,
      recommendationId: rec.id,
      themeId: rec.themeId || undefined,
      title: action,
      description: `Task from recommendation: "${rec.title}"`,
      priority: i === 0 ? priorityMap[rec.severity] : TaskPriority.MEDIUM,
      assignedToId: options?.assignedToId,
      dueDate,
      createdById,
    });

    tasks.push(task);
  }

  // Update recommendation status
  await db.recommendation.update({
    where: { id: recommendationId },
    data: { status: RecommendationStatus.IN_PROGRESS },
  });

  logger.info({
    recommendationId,
    tasksCreated: tasks.length,
  }, 'Tasks created from recommendation');

  return tasks;
}

/**
 * Update a task
 */
export async function updateTask(taskId: string, input: UpdateTaskInput, userId: string) {
  const existingTask = await db.task.findUnique({
    where: { id: taskId },
    select: { status: true, tenantId: true, themeId: true, recommendationId: true },
  });

  if (!existingTask) {
    throw new Error('Task not found');
  }

  const wasCompleted = existingTask.status === TaskStatus.COMPLETED;
  const isBeingCompleted = input.status === TaskStatus.COMPLETED && !wasCompleted;

  // Build update data
  const updateData: Record<string, unknown> = { ...input };
  
  if (isBeingCompleted) {
    updateData.completedAt = new Date();
  } else if (input.status === TaskStatus.IN_PROGRESS && !existingTask.status) {
    updateData.startedAt = new Date();
  }

  const task = await db.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      recommendation: { select: { id: true, title: true, severity: true } },
      theme: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  logger.info({
    taskId,
    userId,
    status: task.status,
    isBeingCompleted,
  }, 'Task updated');

  // Trigger FixScore calculation if task was just completed
  if (isBeingCompleted && task.themeId) {
    try {
      const fixScoreResult = await triggerFixScoreCalculation(task.id, task.tenantId, task.themeId);
      
      // Generate activation drafts if there's positive sentiment improvement
      if (fixScoreResult && qualifiesForActivation(fixScoreResult.result.deltaS, fixScoreResult.result.fixScore)) {
        try {
          const activationResult = await generateDraftsForTask(task.id);
          if (activationResult.success) {
            logger.info({
              taskId,
              draftCount: activationResult.draftIds.length,
            }, 'Activation drafts generated for completed task');
          }
        } catch (activationError) {
          logger.error({ error: activationError, taskId }, 'Failed to generate activation drafts');
          // Don't fail the task update if activation generation fails
        }
      }
    } catch (error) {
      logger.error({ error, taskId }, 'Failed to calculate FixScore');
      // Don't fail the task update if FixScore calculation fails
    }
  }

  // Check if all tasks for recommendation are complete
  if (isBeingCompleted && task.recommendationId) {
    await checkAndUpdateRecommendationStatus(task.recommendationId);
  }

  return task;
}

/**
 * Trigger FixScore calculation for a completed task
 */
async function triggerFixScoreCalculation(taskId: string, tenantId: string, themeId: string) {
  // Get the latest score run for this tenant
  const latestRun = await db.scoreRun.findFirst({
    where: { tenantId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });

  if (!latestRun) {
    logger.warn({ tenantId }, 'No completed score run found for FixScore calculation');
    return;
  }

  const result = await computeAndPersistFixScore({
    taskId,
    themeId,
    tenantId,
    scoreRunId: latestRun.id,
  });

  logger.info({
    taskId,
    themeId,
    fixScoreId: result.id,
    fixScore: result.result.fixScore,
    deltaS: result.result.deltaS,
    confidence: result.result.confidenceLevel,
  }, 'FixScore calculated for completed task');

  return result;
}

/**
 * Check if all tasks for a recommendation are complete and update status
 */
async function checkAndUpdateRecommendationStatus(recommendationId: string) {
  const tasks = await db.task.findMany({
    where: { recommendationId },
    select: { status: true },
  });

  if (tasks.length === 0) return;

  const allComplete = tasks.every(t => t.status === TaskStatus.COMPLETED);
  const anyInProgress = tasks.some(t => t.status === TaskStatus.IN_PROGRESS);

  if (allComplete) {
    await db.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: RecommendationStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
    logger.info({ recommendationId }, 'Recommendation marked as resolved (all tasks complete)');
  } else if (anyInProgress) {
    await db.recommendation.update({
      where: { id: recommendationId },
      data: { status: RecommendationStatus.IN_PROGRESS },
    });
  }
}

/**
 * Get tasks for a tenant with optional filters
 */
export async function getTasks(
  tenantId: string,
  options?: {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    assignedToId?: string;
    recommendationId?: string;
    themeId?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where = {
    tenantId,
    ...(options?.status && { status: { in: options.status } }),
    ...(options?.priority && { priority: { in: options.priority } }),
    ...(options?.assignedToId && { assignedToId: options.assignedToId }),
    ...(options?.recommendationId && { recommendationId: options.recommendationId }),
    ...(options?.themeId && { themeId: options.themeId }),
  };

  const [tasks, total] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        recommendation: { select: { id: true, title: true, severity: true } },
        theme: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        fixScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { fixScore: true, deltaS: true, confidenceLevel: true },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    db.task.count({ where }),
  ]);

  return { tasks, total };
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: string) {
  return db.task.findUnique({
    where: { id: taskId },
    include: {
      recommendation: true,
      theme: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      fixScores: {
        orderBy: { createdAt: 'desc' },
        include: {
          scoreRun: { select: { id: true, periodStart: true, periodEnd: true } },
        },
      },
    },
  });
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string, userId: string) {
  const task = await db.task.delete({
    where: { id: taskId },
  });

  logger.info({ taskId, userId }, 'Task deleted');

  return task;
}
