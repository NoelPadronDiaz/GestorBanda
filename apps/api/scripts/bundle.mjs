// Empaqueta la API compilada (dist/ de `nest build`) en un dist/ autosuficiente para Vercel.
//
// Con pnpm, apps/api/node_modules son enlaces a node_modules/.pnpm de la raíz del monorepo,
// fuera de la carpeta del servicio, y la función de Vercel se desplegaba sin dependencias
// («Cannot find module '@nestjs/common'»). Aquí todo el código (NestJS, @alcaravan/shared…)
// va a un único dist/main.js y se copian como ficheros reales solo los módulos que no se
// pueden empaquetar: Prisma (cliente generado + motor nativo) y argon2 (binario nativo).
//
// Uso: pnpm build && node scripts/bundle.mjs   (lo ejecuta `pnpm build:vercel`)
import { build } from 'esbuild';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(apiDir, 'dist');
const compiled = join(apiDir, '.dist-tsc');
const require = createRequire(join(apiDir, 'package.json'));

if (!existsSync(join(dist, 'main.js')))
  throw new Error('dist/main.js no existe: ejecuta antes `pnpm build`.');
rmSync(compiled, { recursive: true, force: true });
renameSync(dist, compiled);

// Se parte del JS que genera tsc (conserva emitDecoratorMetadata, que la inyección de NestJS necesita).
await build({
  entryPoints: [join(compiled, 'main.js')],
  outfile: join(dist, 'main.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  keepNames: true,
  logLevel: 'warning',
  external: [
    // Nativos o con ficheros que se cargan en tiempo de ejecución: se copian abajo.
    '@prisma/client',
    '.prisma/client',
    '@node-rs/argon2',
    // Integraciones opcionales que NestJS intenta cargar dentro de un try/catch.
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@fastify/static',
    '@fastify/view',
    // @nestjs/mapped-types lo prueba por compatibilidad con class-transformer < 0.5.
    'class-transformer/storage',
  ],
}).catch((error) => {
  rmSync(dist, { recursive: true, force: true });
  renameSync(compiled, dist);
  throw error;
});
rmSync(compiled, { recursive: true, force: true });

const modules = join(dist, 'node_modules');
const copy = (from, to) => cpSync(from, to, { recursive: true, dereference: true });
const packageDir = (name) => dirname(realpathSync(require.resolve(`${name}/package.json`)));

// @prisma/client y el cliente generado (.prisma/client, con el motor de la plataforma del build).
const prismaClient = packageDir('@prisma/client');
copy(prismaClient, join(modules, '@prisma', 'client'));
const generated = join(prismaClient, '..', '..', '.prisma');
if (!existsSync(join(generated, 'client', 'index.js')))
  throw new Error('Falta .prisma/client: ejecuta `prisma generate`.');
copy(generated, join(modules, '.prisma'));

// argon2 y su binario para la plataforma instalada (en Vercel, argon2-linux-x64-gnu).
const argon2 = packageDir('@node-rs/argon2');
const scope = dirname(argon2);
mkdirSync(join(modules, '@node-rs'), { recursive: true });
for (const entry of readdirSync(scope).filter((name) => name.startsWith('argon2'))) {
  copy(join(scope, entry), join(modules, '@node-rs', entry));
}

console.log(`API empaquetada en dist/ (main.js + ${readdirSync(modules).join(', ')}).`);
