// Debug script to check theme data
import { db } from '../src/server/db';

async function debugThemes() {
  console.log('\n=== All Themes ===');
  const themes = await db.theme.findMany({
    select: { id: true, name: true, category: true },
    orderBy: { name: 'asc' },
  });
  console.table(themes);

  console.log('\n=== ReviewThemes with Ambiance ===');
  const ambThemes = themes.filter(t => t.name.toLowerCase().includes('ambiance'));
  for (const theme of ambThemes) {
    const count = await db.reviewTheme.count({ where: { themeId: theme.id } });
    console.log(`Theme "${theme.name}" (${theme.id}): ${count} review associations`);
  }

  console.log('\n=== Recent Reviews with Themes ===');
  const recentReviews = await db.review.findMany({
    where: { reviewDate: { gte: new Date('2026-01-26') } },
    include: { reviewThemes: { include: { theme: true } } },
    take: 5,
  });
  for (const r of recentReviews) {
    console.log(`Review ${r.id.slice(0,8)}... (${r.reviewDate?.toISOString().split('T')[0]})`);
    console.log(`  Content: ${r.content?.slice(0, 60)}...`);
    console.log(`  Themes: ${r.reviewThemes.map(rt => rt.theme.name).join(', ') || 'NONE'}`);
  }

  console.log('\n=== Tasks with Ambiance Theme ===');
  const tasks = await db.task.findMany({
    where: { theme: { name: { contains: 'Ambiance', mode: 'insensitive' } } },
    include: { theme: true },
  });
  for (const t of tasks) {
    console.log(`Task: ${t.title}`);
    console.log(`  Theme ID: ${t.themeId}`);
    console.log(`  Theme Name: ${t.theme?.name}`);
  }
}

debugThemes()
  .catch(console.error)
  .finally(() => db.$disconnect());
