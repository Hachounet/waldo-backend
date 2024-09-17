const { Router } = require("express");

const {
  postLoginPage,
  postNoLoginPage,
  getLeaderboardPage,
  postStartGame,
  postCharacters,
  postSignUpPage,
} = require("../controllers/indexController");

const { authenticateJWT } = require("../auth/passport");

const indexRouter = Router();

indexRouter.post("/start", postStartGame);

indexRouter.post("/play", postCharacters);

indexRouter.post("/signup", postSignUpPage);

indexRouter.post("/login", postLoginPage);

indexRouter.post("/nologin", postNoLoginPage);

indexRouter.get("/leaderboard", authenticateJWT, getLeaderboardPage);

module.exports = indexRouter;
