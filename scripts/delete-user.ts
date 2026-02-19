/**
 * Script to delete a user and all associated data
 * Run with: npx tsx scripts/delete-user.ts "Sam Spencer"
 */

import { db } from '../src/server/db';

async function main() {
  const searchTerm = process.argv[2] || 'Sam Spencer';

  // Find the user
  const user = await db.user.findFirst({
    where: {
      OR: [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      _count: {
        select: {
          memberships: true,
          accounts: true,
          sessions: true,
        }
      }
    }
  });

  if (!user) {
    console.log(`No user found matching "${searchTerm}"`);
    process.exit(1);
  }

  console.log('Found user:', user.firstName, user.lastName);
  console.log('Email:', user.email);
  console.log('ID:', user.id);
  console.log('Related data:');
  console.log('  - Memberships:', user._count.memberships);
  console.log('  - Accounts:', user._count.accounts);
  console.log('  - Sessions:', user._count.sessions);
  console.log('');
  console.log('Deleting user and all related data...');

  await db.user.delete({
    where: { id: user.id }
  });

  console.log('✅ User deleted successfully!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
