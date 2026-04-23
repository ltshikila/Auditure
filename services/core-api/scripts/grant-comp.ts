/**
 * Grant a complimentary PRO subscription for influencer outreach, press, etc.
 *
 * Run from services/core-api:
 *   npx ts-node scripts/grant-comp.ts --email user@example.com --days 30 --reason "influencer:@jane"
 *   npx ts-node scripts/grant-comp.ts --user-id <uuid> --days 30
 *   npx ts-node scripts/grant-comp.ts --email user@example.com --revoke
 *
 * The script reuses SubscriptionsService.grantCompSubscription so logic stays
 * in one place. Against prod, ensure DATABASE_URL is set accordingly.
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { DatabaseService } from '../src/database/database.service';

interface Args {
    email?: string;
    userId?: string;
    days?: number;
    reason?: string;
    revoke?: boolean;
}

function parseArgs(argv: string[]): Args {
    const args: Args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case '--email':
                args.email = next;
                i++;
                break;
            case '--user-id':
                args.userId = next;
                i++;
                break;
            case '--days':
                args.days = parseInt(next, 10);
                i++;
                break;
            case '--reason':
                args.reason = next;
                i++;
                break;
            case '--revoke':
                args.revoke = true;
                break;
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
        }
    }
    return args;
}

function printUsage() {
    console.log(`
Usage: grant-comp.ts [options]

  --email <addr>      User email (either this or --user-id required)
  --user-id <uuid>    User ID
  --days <n>          Comp duration in days (required for grant)
  --reason <str>      Audit reason, e.g. "influencer:@jane"
  --revoke            Revoke existing comp instead of granting
  --help              Show this message

Examples:
  Grant 30-day PRO comp by email:
    npx ts-node scripts/grant-comp.ts --email jane@creator.com --days 30 --reason "influencer:@jane"

  Revoke a comp:
    npx ts-node scripts/grant-comp.ts --email jane@creator.com --revoke
`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!args.email && !args.userId) {
        console.error('Error: either --email or --user-id is required');
        printUsage();
        process.exit(1);
    }

    if (!args.revoke && (!args.days || args.days <= 0)) {
        console.error('Error: --days (positive integer) is required for grant');
        printUsage();
        process.exit(1);
    }

    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    try {
        const db = app.get(DatabaseService);
        const subscriptions = app.get(SubscriptionsService);

        // Resolve user
        let userId = args.userId;
        if (!userId && args.email) {
            const user = await db.user.findUnique({ where: { email: args.email } });
            if (!user) {
                console.error(`No user found with email ${args.email}`);
                process.exit(2);
            }
            userId = user.id;
            console.log(`Resolved ${args.email} → ${userId}`);
        }

        if (!userId) {
            console.error('Could not resolve user');
            process.exit(2);
        }

        if (args.revoke) {
            await subscriptions.revokeCompSubscription(userId);
            console.log(`✓ Comp revoked for user ${userId}`);
        } else {
            const result = await subscriptions.grantCompSubscription(userId, {
                durationDays: args.days!,
                reason: args.reason ?? null,
            });
            const verb = result.extended ? 'extended' : 'granted';
            console.log(
                `✓ Comp ${verb} for user ${userId}: PRO until ${result.expiresAt.toISOString()}`,
            );
        }
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        await app.close();
        process.exit(1);
    }

    await app.close();
    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
