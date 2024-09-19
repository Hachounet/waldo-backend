const { Router } = require("express");

const {
  postLeaderboardPage,
  postStartGame,
  postCharacters,
  postPseudoPage,
} = require("../controllers/indexController");

const indexRouter = Router();

indexRouter.post("/start", postStartGame);

indexRouter.post("/play", postCharacters);

indexRouter.post("/pseudo", postPseudoPage);

indexRouter.post("/leaderboard", postLeaderboardPage);

module.exports = indexRouter;
