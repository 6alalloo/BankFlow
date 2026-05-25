import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.audit_logs.deleteMany();
  await prisma.cases.deleteMany();

  console.log("Cleared runtime demo data. Run `npm.cmd run db:seed` to recreate the seeded demo cases.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
