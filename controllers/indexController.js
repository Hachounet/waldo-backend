const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const asyncHandler = require("express-async-handler");
const { validationResult, body } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const errorMessages = require("../errorMessages");

function checkForJSAttack(value) {
  const regex = /<script.*?>.*?<\/script>/i; // Regex to check for JS code
  if (regex.test(value)) {
    throw new Error(errorMessages.USERNAME_JAVASCRIPT);
  }
  const invalidChars = /[^a-zA-Z0-9-_]/; // Allow letters, numbers, - and _
  if (invalidChars.test(value)) {
    throw new Error(errorMessages.USERNAME_INVALID_CHARS);
  }
  return true;
}

const validateSignUp = [
  body("pseudo")
    .trim() // Delete white space
    .notEmpty()
    .withMessage(`Pseudo ${errorMessages.NOT_EMPTY}`)
    .isLength({ min: 3, max: 20 })
    .withMessage(`Pseudo ${errorMessages.LENGTH_3_TO_20}`)
    .custom(checkForJSAttack),
  body("email")
    .trim()
    .escape()
    .notEmpty()
    .withMessage(`Email ${errorMessages.NOT_EMPTY}`)
    .normalizeEmail()
    .isEmail()
    .withMessage(`${errorMessages.MAIL_FORMAT}`),
  body("pw")
    .notEmpty()
    .withMessage(`Password ${errorMessages.NOT_EMPTY}`)
    .trim()
    .isLength({ min: 6 })
    .withMessage(`Password ${errorMessages.LENGTH_6}`)
    .custom(checkForJSAttack)
    .custom((value, { req }) => {
      if (value !== req.body.confpw) {
        throw new Error(errorMessages.PASSWORDS_DO_NOT_MATCH);
      }
      return true;
    }),
];

exports.postSignUpPage = [
  validateSignUp,
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userExists = await prisma.user.findUnique({
      where: { email: req.body.email },
    });
    if (userExists) {
      return res
        .status(400)
        .json({ error: errorMessages.EMAIL_ALREADY_EXISTS });
    }

    const hashedPassword = await bcrypt.hash(req.body.pw, 10);
    await prisma.user.create({
      data: {
        email: req.body.email,
        pseudo: req.body.pseudo,
        hash: hashedPassword,
      },
    });
    return res
      .status(200)
      .json({ success: true, message: "Account successfully created!" });
  }),
];

exports.postLoginPage = asyncHandler(async (req, res, next) => {
  console.log("POST Login Page for:", req.body.email);

  const errors = [];

  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });

  if (!user) {
    errors.push({ msg: errorMessages.INVALID_EMAIL });
  }

  let isPasswordValid = true;
  if (user) {
    isPasswordValid = await bcrypt.compare(req.body.pw, user.hash);
    if (!isPasswordValid) {
      errors.push({ msg: errorMessages.INVALID_PASSWORD });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "3600000",
  });

  return res.status(200).json({ message: "User logged in", accessToken });
});

exports.postNoLoginPage = asyncHandler(async (req, res, next) => {
  const session = await prisma.gameSession.findUnique({
    where: { sessionId: req.body.sessionId },
  });

  if (!session) {
    return res.status(404).json({ message: errorMessages.SESSION_NOT_FOUND });
  }

  await prisma.gameSession.delete({ where: { sessionId: req.body.sessionId } });
  return res.json({ sessionDeleted: true });
});

exports.getLeaderboardPage = asyncHandler(async (req, res, next) => {
  console.log("GET Leaderboard Page");

  const session = await prisma.gameSession.findUnique({
    where: { sessionId: req.body.sessionId },
    include: { player: true },
  });

  if (!session || !session.endTime) {
    return res.status(400).json({ message: errorMessages.INVALID_SESSION });
  }

  const allUsers = await prisma.user.findMany({
    include: {
      sessions: {
        where: {
          elapsedTime: { not: null }, // Filtrer les sessions terminées
        },
      },
    },
  });

  const rankedUsers = allUsers
    .map((user) => {
      const bestSession = user.sessions.reduce((best, current) => {
        return !best || current.elapsedTime < best.elapsedTime ? current : best;
      }, null);
      return { user, bestSession };
    })
    .filter((entry) => entry.bestSession)
    .sort((a, b) => a.bestSession.elapsedTime - b.bestSession.elapsedTime);

  // Find player rank
  const playerRank =
    rankedUsers.findIndex((entry) => entry.user.id === session.playerId) + 1;

  return res.status(200).json({
    rankedUsers,
    rank: playerRank,
  });
});

exports.postStartGame = asyncHandler(async (req, res, next) => {
  const session = await prisma.gameSession.create({ data: {} });
  res.json({ sessionId: session.sessionId });
});

exports.postCharacters = asyncHandler(async (req, res, next) => {
  console.log(req.body);

  const character = await prisma.characters.findUnique({
    where: {
      name: req.body.characterName,
    },
  });

  if (!character) {
    return res.status(404).json({ message: errorMessages.CHARACTER_NOT_FOUND });
  }

  // PosX && posY are scaled and normalized.
  const posX = req.body.posX;
  const posY = req.body.posY;

  const withinRangeX = posX >= character.posX - 5 && posX <= character.posX + 5;
  const withinRangeY = posY >= character.posY - 5 && posY <= character.posY + 5;

  if (withinRangeX && withinRangeY) {
    const updatedSession = await prisma.gameSession.update({
      where: {
        sessionId: req.body.sessionId,
      },
      data: {
        charactersFound: {
          increment: 1,
        },
      },
      include: {
        player: true,
      },
    });

    if (
      updatedSession.charactersFound === Number(process.env.NUMBOFCHARACTERS)
    ) {
      const elapsedTimeInMs = new Date() - updatedSession.startTime;
      const elapsedTimeInSeconds = Math.floor(elapsedTimeInMs / 1000);

      await prisma.gameSession.update({
        where: {
          sessionId: req.body.sessionId,
        },
        data: {
          elapsedTime: elapsedTimeInMs,
          endTime: {
            set: new Date(),
          },
        },
      });
      return res.status(200).json({
        endOfGame: true,
        time: elapsedTimeInSeconds,
        characterFound: true,
        characterName: character,
      });
    }

    return res
      .status(200)
      .json({ characterFound: true, characterName: character });
  } else {
    return res.status(200).json({ characterFound: false });
  }
});
