/**
 * Backfill script to compute and store geminiVoiceName for existing podcasters.
 *
 * Run with: npx ts-node scripts/backfill-gemini-voices.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { selectGeminiVoice } from '../src/podcasters/utils/gemini-voice-selector';

// Prisma v7 requires adapter for PostgreSQL
const dbUrl = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5432/auditure_db';
const url = new URL(dbUrl);

const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function backfillGeminiVoices() {
  console.log('Starting backfill of geminiVoiceName for existing podcasters...\n');

  // Get all podcasters without a geminiVoiceName
  const podcasters = await prisma.podcaster.findMany({
    where: {
      geminiVoiceName: null,
    },
    select: {
      id: true,
      name: true,
      gender: true,
      voiceModel: true,
      speakingSpeed: true,
      vocalPitch: true,
    },
  });

  console.log(`Found ${podcasters.length} podcasters without geminiVoiceName\n`);

  if (podcasters.length === 0) {
    console.log('All podcasters already have voice names assigned!');
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const podcaster of podcasters) {
    try {
      // Compute the Gemini voice
      const geminiVoiceName = selectGeminiVoice({
        gender: podcaster.gender as 'MALE' | 'FEMALE',
        voiceModel: podcaster.voiceModel,
        speakingSpeed: podcaster.speakingSpeed,
        vocalPitch: podcaster.vocalPitch,
      });

      // Update the podcaster
      await prisma.podcaster.update({
        where: { id: podcaster.id },
        data: { geminiVoiceName },
      });

      console.log(
        `✓ ${podcaster.name}: ${geminiVoiceName} ` +
          `(${podcaster.gender}, ${podcaster.voiceModel}, speed=${podcaster.speakingSpeed}, pitch=${podcaster.vocalPitch})`,
      );
      updated++;
    } catch (error) {
      console.error(`✗ Failed to update ${podcaster.name}: ${error}`);
      errors++;
    }
  }

  console.log(`\nBackfill complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
}

backfillGeminiVoices()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
