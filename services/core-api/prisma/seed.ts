import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Prisma v7 requires an adapter for PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'bookcast',
  user: 'postgres',
  password: 'postgres',
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
    where: { email: 'test@bookcast.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'test@bookcast.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'demo@bookcast.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'demo@bookcast.com',
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
      accent: 'American',
      speakingSpeed: 5,
      vocalPitch: 5,
      vocabularyComplexity: 8,
      ageTone: 6,
      tone: 4,
      communicationStyle: 8,
      humorLevel: 3,
      conversationalDepth: 9,
      expertiseTags: ['Philosophy', 'Science', 'Technology', 'Psychology'],
      intellectualAngle: 'Critical and Analytical',
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
      accent: 'British',
      speakingSpeed: 7,
      vocalPitch: 6,
      vocabularyComplexity: 6,
      ageTone: 4,
      tone: 8,
      communicationStyle: 2,
      humorLevel: 7,
      conversationalDepth: 5,
      expertiseTags: ['Literature', 'Arts', 'History', 'Culture'],
      intellectualAngle: 'Open-minded and Creative',
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
      accent: 'Australian',
      speakingSpeed: 4,
      vocalPitch: 4,
      vocabularyComplexity: 5,
      ageTone: 7,
      tone: 2,
      communicationStyle: 5,
      humorLevel: 4,
      conversationalDepth: 7,
      expertiseTags: ['Mindfulness', 'Self-Help', 'Philosophy'],
      intellectualAngle: 'Balanced and Reflective',
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
      extractionStatus: 'PROCESSING',
    },
  });

  console.log('Created books:', {
    book1: book1.title,
    book2: book2.title,
  });

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
