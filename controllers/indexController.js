const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const asyncHandler = require("express-async-handler");
const { validationResult, body } = require("express-validator");
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

const validatePseudo = [
  body("pseudo")
    .trim() // Delete white space
    .notEmpty()
    .withMessage(`Pseudo ${errorMessages.NOT_EMPTY}`)
    .isLength({ min: 3, max: 20 })
    .withMessage(`Pseudo ${errorMessages.LENGTH_3_TO_20}`)
    .custom(checkForJSAttack),
];

exports.postPseudoPage = [
  validatePseudo,
  asyncHandler(async (req, res, next) => {
    const sessionId = req.body.sessionId;
    const pseudo = req.body.pseudo;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pseudoUser = await prisma.gameSession.update({
      where: { sessionId: sessionId },
      data: {
        pseudo: pseudo,
      },
    });
    return res.status(200).json({ success: true, pseudoUser: pseudoUser.name });
  }),
];

exports.postLeaderboardPage = asyncHandler(async (req, res, next) => {
  const sessionId = req.body.sessionId;

  // Find session of player
  const session = await prisma.gameSession.findUnique({
    where: { sessionId: sessionId },
  });

  if (!session || !session.endTime) {
    return res.status(400).json({ message: errorMessages.INVALID_SESSION });
  }

  // Retrieve top 10 sessions for sort
  const allSessions = await prisma.gameSession.findMany({
    where: {
      elapsedTime: { not: null },
    },
    orderBy: {
      elapsedTime: "asc",
    },
    take: 10,
  });

  const rankedUsers = allSessions.map((session, index) => ({
    pseudo: session.pseudo,
    elapsedTime: session.elapsedTime,
    rank: index + 1,
  }));

  // Find the player's rank
  const playerRank = rankedUsers.find(
    (entry) => entry.pseudo === session.pseudo,
  );

  return res.status(200).json({
    rankedUsers,
    rank: playerRank ? playerRank.rank : null,
    playerElapsedTime: session.elapsedTime,
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

  const posX = req.body.posX;
  const posY = req.body.posY;

  const withinRangeX = posX >= character.posX - 5 && posX <= character.posX + 5;
  const withinRangeY = posY >= character.posY - 5 && posY <= character.posY + 5;

  const session = await prisma.gameSession.findUnique({
    where: {
      sessionId: req.body.sessionId,
    },
  });

  if (session.foundCharactersName.includes(character.name)) {
    return res.status(200).json({ characterFound: false });
  }

  if (withinRangeX && withinRangeY) {
    const updatedSession = await prisma.gameSession.update({
      where: {
        sessionId: req.body.sessionId,
      },
      data: {
        charactersFound: {
          increment: 1,
        },
        foundCharactersName: {
          push: character.name,
        },
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
