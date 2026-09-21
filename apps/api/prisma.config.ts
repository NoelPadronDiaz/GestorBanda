import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Con prisma.config.ts Prisma ya no carga .env por sí mismo. Las variables ya definidas
// (Docker, CI) tienen prioridad: dotenv no las sobrescribe.
loadEnv({ path: '.env', quiet: true });
loadEnv({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
