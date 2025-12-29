// Quick script to view database contents
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('\n=== DATABASE CONTENTS ===\n');

    // Get all users
    const users = await prisma.user.findMany({
      include: {
        books: {
          include: {
            chapters: true
          }
        }
      }
    });

    console.log(`Found ${users.length} users:\n`);

    users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Email Verified: ${user.isEmailVerified}`);
      console.log(`   Books: ${user.books.length}`);
      if (user.books.length > 0) {
        user.books.forEach((book, j) => {
          console.log(`   ${j + 1}. "${book.title}" by ${book.author || 'Unknown'}`);
          console.log(`      Status: ${book.extractionStatus}, Chapters: ${book.chapters.length}`);
        });
      }
      console.log('');
    });

    // Get total counts
    const userCount = await prisma.user.count();
    const bookCount = await prisma.book.count();
    const chapterCount = await prisma.chapter.count();

    console.log('=== SUMMARY ===');
    console.log(`Total Users: ${userCount}`);
    console.log(`Total Books: ${bookCount}`);
    console.log(`Total Chapters: ${chapterCount}\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
