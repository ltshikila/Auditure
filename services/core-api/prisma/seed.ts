import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Prisma v7 requires an adapter for PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'auditure_db',
  user: 'admin',
  password: 'password',
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function main() {
  console.log('Starting database seed...');

  // Create test users
  const hashedPassword = await bcrypt.hash('Password123', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'test@auditure.app' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'test@auditure.app',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'demo@auditure.app' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'demo@auditure.app',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      dateOfBirth: new Date('1990-01-01'),
      isEmailVerified: true,
    },
  });

  console.log('Created users:', { user1: user1.email, user2: user2.email });

  // Create sample podcasters for user1
  const podcaster1 = await prisma.podcaster.create({
    data: {
      userId: user1.id,
      name: 'The Analytical Thinker',
      description: 'A thoughtful analyst who breaks down complex topics with clarity and precision.',
      voiceModel: 'ACADEMIC',
      gender: 'MALE',
      accent: 'United States',
      speakingSpeed: 4,
      vocalPitch: 5,
      ageTone: 6,
      sentenceStructure: 8, // Very elaborate
      emotionalExpression: 2, // Controlled, analytical
      tone: 3,
      communicationStyle: 7, // More analytical
      humorLevel: 2,
      conversationalDepth: 9,
      chaosFactor: 1, // Extremely controlled
      expertiseTags: ['Philosophy', 'Science', 'Psychology'],
      intellectualAngle: 'Critical',
      viewpointBehavior: 7,
      isPublic: true,
    },
  });

  const podcaster2 = await prisma.podcaster.create({
    data: {
      userId: user1.id,
      name: 'The Energetic Storyteller',
      description: 'An enthusiastic narrator who brings stories to life with passion and energy.',
      voiceModel: 'ENERGETIC',
      gender: 'FEMALE',
      accent: 'United Kingdom',
      speakingSpeed: 7,
      vocalPitch: 6,
      ageTone: 4,
      sentenceStructure: 3, // Concise, punchy
      emotionalExpression: 9, // Highly expressive
      tone: 8,
      communicationStyle: 2,
      humorLevel: 7,
      conversationalDepth: 5,
      chaosFactor: 8, // Highly passionate
      expertiseTags: ['Literature', 'Arts', 'History'],
      intellectualAngle: 'Idealistic',
      viewpointBehavior: 4,
      isPublic: true,
      playCount: 42,
      likeCount: 15,
    },
  });

  const podcaster3 = await prisma.podcaster.create({
    data: {
      userId: user2.id,
      name: 'The Calm Guide',
      description: 'A soothing presence that helps you absorb information at a peaceful pace.',
      voiceModel: 'CALM',
      gender: 'MALE',
      accent: 'Australia',
      speakingSpeed: 4,
      vocalPitch: 4,
      ageTone: 7,
      sentenceStructure: 7, // More elaborate
      emotionalExpression: 3, // Controlled expression
      tone: 2,
      communicationStyle: 5,
      humorLevel: 4,
      conversationalDepth: 7,
      chaosFactor: 2, // Very measured
      expertiseTags: ['Mindfulness', 'Self-Help', 'Philosophy'],
      intellectualAngle: 'Accepting',
      viewpointBehavior: 5,
      isPublic: false,
    },
  });

  console.log('Created podcasters:', {
    podcaster1: podcaster1.name,
    podcaster2: podcaster2.name,
    podcaster3: podcaster3.name,
  });

  // Create a sample book for user1
  const book1 = await prisma.book.create({
    data: {
      userId: user1.id,
      title: 'The Art of Software Development',
      author: 'Jane Developer',
      isbn: '978-1-23456-789-0',
      language: 'en',
      pageCount: 350,
      sourceType: 'PDF',
      originalFileName: 'software-development.pdf',
      fileStorageKey: 'books/sample-book-1.pdf',
      fileSize: 2048000,
      fileMimeType: 'application/pdf',
      coverImageUrl: 'https://covers.openlibrary.org/b/id/8225261-L.jpg',
      extractionStatus: 'COMPLETED',
      extractedAt: new Date(),
      fullTextKey: 'books/sample-book-1-text.txt',
      chapters: {
        create: [
          {
            chapterNumber: 1,
            title: 'Introduction to Software Development',
            startPage: 1,
            endPage: 25,
            textLength: 12500,
            extractedText: 'Software development is both an art and a science...',
          },
          {
            chapterNumber: 2,
            title: 'Design Patterns and Best Practices',
            startPage: 26,
            endPage: 75,
            textLength: 25000,
            extractedText: 'Understanding design patterns is crucial for building maintainable software...',
          },
          {
            chapterNumber: 3,
            title: 'Testing and Quality Assurance',
            startPage: 76,
            endPage: 125,
            textLength: 22000,
            extractedText: 'Testing is an integral part of the software development lifecycle...',
          },
        ],
      },
    },
  });

  const book2 = await prisma.book.create({
    data: {
      userId: user2.id,
      title: 'Mindful Living',
      author: 'Dr. Sarah Peace',
      language: 'en',
      pageCount: 180,
      sourceType: 'EPUB',
      originalFileName: 'mindful-living.epub',
      fileStorageKey: 'books/sample-book-2.epub',
      fileSize: 1024000,
      fileMimeType: 'application/epub+zip',
      coverImageUrl: 'https://covers.openlibrary.org/b/id/8091016-L.jpg',
      extractionStatus: 'COMPLETED',
      extractedAt: new Date(),
      fullTextKey: 'books/sample-book-2-text.txt',
      chapters: {
        create: [
          {
            chapterNumber: 1,
            title: 'The Art of Being Present',
            startPage: 1,
            endPage: 30,
            textLength: 15000,
            extractedText: 'Mindfulness begins with awareness of the present moment...',
          },
          {
            chapterNumber: 2,
            title: 'Breathing and Meditation',
            startPage: 31,
            endPage: 60,
            textLength: 14000,
            extractedText: 'The breath is our anchor to the present...',
          },
        ],
      },
    },
  });

  console.log('Created books:', {
    book1: book1.title,
    book2: book2.title,
  });

  // Make all existing episodes public and give them some engagement metrics
  const updatedEpisodes = await prisma.episode.updateMany({
    where: {
      generationStatus: 'COMPLETED',
    },
    data: {
      isPublic: true,
    },
  });

  console.log(`Made ${updatedEpisodes.count} completed episodes public`);

  // Make all podcasters public
  const updatedPodcasters = await prisma.podcaster.updateMany({
    data: {
      isPublic: true,
    },
  });

  console.log(`Made ${updatedPodcasters.count} podcasters public`);

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
