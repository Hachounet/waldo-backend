const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const batman = await prisma.characters.create({
    data: {
      name: "Batman",
      posX: 874,
      posY: 937,
    },
  });

  const gladys = await prisma.characters.create({
    data: {
      name: "Gladys",
      posX: 421,
      posY: 1850,
    },
  });

  const grievious = await prisma.characters.create({
    data: {
      name: "Grievious",
      posX: 1778,
      posY: 2062,
    },
  });

  const mrBook = await prisma.characters.create({
    data: {
      name: "Mr.Book",
      posX: 1098,
      posY: 2024,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
