const dotenv = require("dotenv");
dotenv.config();
const errorMessages = require("./errorMessages");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cron = require("node-cron");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");

const indexRouter = require("./routes/indexRouter");

const prisma = new PrismaClient(); // Only for deleting inactive sessions
const app = express();

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS || "*",
  methods: "GET, HEAD, PUT, PATCH, POST, DELETE",
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

// Function to check and delete inactive sessions
async function cleanInactiveSessions() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  try {
    const deletedSessions = await prisma.gameSession.deleteMany({
      where: {
        endTime: null,
        startTime: {
          lt: thirtyMinutesAgo,
        },
      },
    });
    console.log(`${deletedSessions.count} sessions deleted for inactivity.`);
  } catch (err) {
    console.error("Error while deleting inactive sessions :", err);
  }
}
// Check inactive sessions when server start
cleanInactiveSessions();

// Check again every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  await cleanInactiveSessions();
});

// Err handling
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log("Errors details", {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      body: req.body,
      query: req.query,
    });
  }

  const statusCode = err.status || 500;

  // Specific error handling
  let errorMessage = err.message;
  if (err.code === "P2002") {
    // Prisma: Unicity violation
    const target = err.meta.target[0];
    if (target === "email") {
      errorMessage = errorMessages.EMAIL_ALREADY_EXISTS;
    } else if (target === "pseudo") {
      errorMessage = errorMessages.PSEUDO_ALREADY_EXISTS;
    }
  }

  // Validation error handling
  if (err.name === "ValidationError") {
    errorMessage = errorMessages.VALIDATION_ERROR;
  }

  res.status(statusCode).json({
    error: { message: errorMessage },
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server launched on port ${PORT}`);
});
