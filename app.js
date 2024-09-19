const dotenv = require("dotenv");
dotenv.config();
const errorMessages = require("./errorMessages");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");

const indexRouter = require("./routes/indexRouter");

const prisma = new PrismaClient(); // Only for deleting inactive sessions
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

const corsOptions = {
  origin: (origin, callback) => {
    // Autorise les requêtes sans origine (par exemple Postman ou requêtes serveur à serveur)
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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
