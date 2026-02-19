/**
 * Script to delete a tenant and all associated data
 * Run with: npx tsx scripts/delete-tenant.ts "Harbour"
 */

import { db } from '../src/server/db';

async function main() {
  const searchTerm = process.argv[2];
  
  if (!searchTerm) {
    console.log('Usage: npx tsx scripts/delete-tenant.ts <search-term>');
    console.log('Example: npx tsx scripts/delete-tenant.ts "Harbour"');
    process.exit(1);
  }

  // Find the tenant
  const tenant = await db.tenant.findFirst({
    where: {
      name: { contains: searchTerm, mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          reviews: true,
          connectors: true,
          scoreRuns: true,
          tasks: true,
          recommendations: true,
          fixScores: true,
          themeScores: true,
        }
      }
    }
  });

  if (!tenant) {
    console.log(`No tenant found matching "${searchTerm}"`);
    process.exit(1);
  }

  console.log('Found tenant:', tenant.name);
  console.log('ID:', tenant.id);
  console.log('Related data:');
  console.log('  - Reviews:', tenant._count.reviews);
  console.log('  - Connectors:', tenant._count.connectors);
  console.log('  - Score Runs:', tenant._count.scoreRuns);
  console.log('  - Tasks:', tenant._count.tasks);
  console.log('  - Recommendations:', tenant._count.recommendations);
  console.log('  - Fix Scores:', tenant._count.fixScores);
  console.log('  - Theme Scores:', tenant._count.themeScores);
  console.log('');
  console.log('Deleting tenant and all related data...');

  // Delete the tenant (cascades will handle related records)
  await db.tenant.delete({
    where: { id: tenant.id }
  });

  console.log('✅ Tenant and all related data deleted successfully!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
