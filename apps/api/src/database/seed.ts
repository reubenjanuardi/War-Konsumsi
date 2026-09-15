import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnvironmentConfig } from '../config/env.js';
import { events, categories, participants } from './schema/index.js';
import { EventStatus } from '@war-konsumsi/shared';

export async function runSeed() {
  const config = getEnvironmentConfig();
  const client = postgres(config.databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log('🌱 Starting database seeding...');

  try {
    // 1. Create a sample war event
    const startsAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    const [event] = await db.insert(events).values({
      name: 'War Konsumsi Tech Gathering 2026',
      status: EventStatus.WAITING,
      selectionStartsAt: startsAt,
      selectionEndsAt: endsAt,
    }).returning();

    console.log(`✅ Event created: "${event.name}" [${event.id}] (Status: ${event.status})`);

    // 2. Insert sample categories for the event
    const sampleCategories = [
      {
        eventId: event.id,
        name: 'Ayam Bakar Madu',
        description: 'Ayam bakar kecap madu gurih manis disajikan lengkap dengan nasi hangat dan sambal terasi.',
        quota: 50,
        remainingQuota: 50,
        isActive: true,
      },
      {
        eventId: event.id,
        name: 'Rendang Sapi Spesial',
        description: 'Daging sapi empuk dengan bumbu rempah rendang Minang kaya rasa dan gurih.',
        quota: 30,
        remainingQuota: 30,
        isActive: true,
      },
      {
        eventId: event.id,
        name: 'Ikan Bakar Jimbaran',
        description: 'Fillet ikan kakap bakar segar dengan lumuran saus jimbaran dan sambal matah.',
        quota: 20,
        remainingQuota: 20,
        isActive: true,
      },
      {
        eventId: event.id,
        name: 'Bakso Sapi Urat Komplit',
        description: 'Bakso urat sapi asli dengan tahu bakso, pangsit renyah, dan kuah kaldu sapi gurih.',
        quota: 25,
        remainingQuota: 25,
        isActive: true,
      },
      {
        eventId: event.id,
        name: 'Vegan Mushroom Grain Bowl',
        description: 'Jamur portobello panggang, quinoa, edamame, alpukat, dan saus sesame dressing.',
        quota: 15,
        remainingQuota: 15,
        isActive: true,
      },
    ];

    const insertedCategories = await db.insert(categories).values(sampleCategories).returning();
    console.log(`✅ Seeded ${insertedCategories.length} categories:`);
    for (const cat of insertedCategories) {
      console.log(`   - ${cat.name} (Quota: ${cat.quota}/${cat.remainingQuota})`);
    }

    // 3. Insert sample participant
    const [participant] = await db.insert(participants).values({
      eventId: event.id,
      name: 'Reuben Peserta',
    }).returning();

    console.log(`✅ Seeded sample participant: ${participant.name} [${participant.id}]`);
    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
