/**
 * set-admin.mjs — Asigna rol ADMIN a un usuario por email
 * Uso: $env:DATABASE_URL="postgresql://..."; node scripts/set-admin.mjs <email>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2];

if (!email) {
  console.error('❌  Uso: node scripts/set-admin.mjs <email>');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌  No se encontró ningún usuario con email: ${email}`);
    process.exit(1);
  }

  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  console.log(`✅  Usuario "${user.name}" (${email}) actualizado a rol ADMIN.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
