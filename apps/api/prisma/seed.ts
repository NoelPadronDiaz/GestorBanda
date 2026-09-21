/**
 * Seed idempotente: sincroniza el catálogo de permisos/roles con packages/shared y, si se
 * definen SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD, crea el primer administrador.
 * Se puede ejecutar en cada despliegue.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { PERMISSIONS, ROLE_CODES, ROLE_NAMES, ROLE_PERMISSIONS } from '@alcaravan/shared';

loadEnv({ path: '.env', quiet: true });
loadEnv({ path: '../../.env', quiet: true });

const prisma = new PrismaClient();

async function syncCatalog(): Promise<void> {
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code }, create: { code }, update: {} });
  }
  await prisma.permission.deleteMany({ where: { code: { notIn: [...PERMISSIONS] } } });

  const permissions = await prisma.permission.findMany();
  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  for (const code of ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: ROLE_NAMES[code], isSystem: true },
      update: { name: ROLE_NAMES[code], isSystem: true },
    });
    const desired = ROLE_PERMISSIONS[code].map((permission) => permissionIdByCode.get(permission)!);

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: desired } },
    });
    await prisma.rolePermission.createMany({
      data: desired.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
  console.log(`Catalog synced: ${PERMISSIONS.length} permissions, ${ROLE_CODES.length} roles.`);
}

async function ensureBandProfile(): Promise<void> {
  await prisma.bandProfile.upsert({
    where: { id: 1 },
    create: { id: 1, name: process.env.SEED_BAND_NAME ?? 'Mi banda' },
    update: {},
  });
}

async function ensureAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: skipping admin creation.');
    return;
  }
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
  if (await prisma.userAccount.findUnique({ where: { email } })) return;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  await prisma.$transaction(async (tx) => {
    const user = await tx.userAccount.create({
      data: { email, passwordHash, roles: { create: { roleId: adminRole.id } } },
    });
    await tx.auditLog.create({
      data: {
        action: 'users.created',
        entityType: 'USER_ACCOUNT',
        entityId: user.id,
        after: { email, role_code: 'ADMIN' },
        metadata: { source: 'seed' },
      },
    });
  });
  console.log(`Admin user created: ${email}`);
}

async function main(): Promise<void> {
  await syncCatalog();
  await ensureBandProfile();
  await ensureAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
