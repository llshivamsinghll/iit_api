require("dotenv").config(); 
const app = require("./app");
const prisma = require("./config/db");
require("dotenv").config();
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await prisma.$connect();
    console.log("Connected to database");
});
