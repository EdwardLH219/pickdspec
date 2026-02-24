/**
 * Delete all reviews for a specific tenant (by name search)
 * Usage: DATABASE_URL="..." npx tsx scripts/delete-tenant-reviews.ts "Coffee Junction"
 */

import { db } from '../src/server/db';

async function main() {
  const searchTerm = process.argv[2];
  
  if (!searchTerm) {
    console.error('Usage: npx tsx scripts/delete-tenant-reviews.ts "tenant name"');
    process.exit(1);
  }
  
  console.log(`\nSearching for tenant matching: "${searchTerm}"...\n`);
  
  // Find tenant by name
  const tenant = await db.tenant.findFirst({
    where: {
      name: { contains: searchTerm, mode: 'insensitive' }
    },
    include: {
      _count: {
        select: {
          reviews: true,
          scoreRuns: true,
        }
      }
    }
  });
  
  if (!tenant) {
    console.error(`No tenant found matching "${searchTerm}"`);
    process.exit(1);
  }
  
  console.log(`Found tenant: ${tenant.name} (ID: ${tenant.id})`);
  console.log(`  - Reviews: ${tenant._count.reviews}`);
  console.log(`  - Score Runs: ${tenant._count.scoreRuns}`);
  
  if (tenant._count.reviews === 0) {
    console.log('\nNo reviews to delete.');
    process.exit(0);
  }
  
  console.log(`\nDeleting ${tenant._count.reviews} reviews...`);
  
  // Delete all reviews for this tenant (cascades to ReviewTheme, ReviewScore)
  const deleted = await db.review.deleteMany({
    where: { tenantId: tenant.id }
  });
  
  console.log(`\nDeleted ${deleted.count} reviews.`);
  
  // Also delete score runs since they're now orphaned
  if (tenant._count.scoreRuns > 0) {
    console.log(`Deleting ${tenant._count.scoreRuns} orphaned score runs...`);
    const deletedRuns = await db.scoreRun.deleteMany({
      where: { tenantId: tenant.id }
    });
    console.log(`Deleted ${deletedRuns.count} score runs.`);
  }
  
  console.log('\nDone! Tenant is ready for fresh review import.');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
