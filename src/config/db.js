const { PrismaClient } = require("@prisma/client");
require("dotenv").config(); // Load environment variables

const prisma = new PrismaClient(); // No need to pass datasourceUrl, Prisma reads from .env

module.exports = prisma;
