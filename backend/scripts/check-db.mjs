import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:mtLSLMMOreDfqjuQhbUqTrckBVyAgImD@turntable.proxy.rlwy.net:51889/railway' } },
});

const tx = await p.transaction.count();
const b = await p.budget.count();
const g = await p.goal.count();
const u = await p.user.count();
const d = await p.importedDocument.count();

console.log(`Transactions: ${tx}`);
console.log(`Budgets: ${b}`);
console.log(`Goals: ${g}`);
console.log(`Users: ${u}`);
console.log(`ImportedDocuments: ${d}`);

// Check for PDF-imported transactions still lingering
const pdfTx = await p.transaction.count({ where: { importSource: 'pdf' } });
console.log(`PDF-imported transactions: ${pdfTx}`);

await p.$disconnect();
