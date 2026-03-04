import { PrismaClient } from '@prisma/client';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:mtLSLMMOreDfqjuQhbUqTrckBVyAgImD@turntable.proxy.rlwy.net:51889/railway';

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

async function main() {
  const count = await prisma.transaction.count({ where: { importSource: 'pdf' } });
  console.log(`Transacciones importadas por PDF: ${count}`);

  if (count === 0) {
    console.log('No hay nada que borrar.');
    return;
  }

  const result = await prisma.transaction.deleteMany({ where: { importSource: 'pdf' } });
  console.log(`Eliminadas: ${result.count} transacciones`);

  // Also clean up imported documents
  const docs = await prisma.importedDocument.count();
  if (docs > 0) {
    const delDocs = await prisma.importedDocument.deleteMany({});
    console.log(`Documentos importados eliminados: ${delDocs.count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
