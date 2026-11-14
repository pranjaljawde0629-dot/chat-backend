import prisma from "./prisma";

async function testConnection() {
  try {
    await prisma.$connect();

    console.log("MySQL database connected successfully through Prisma!");
  } catch (error) {
    console.error("Database connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();