// Authentication with custom account (JWT) for save user in leaderboard

const { ExtractJwt, Strategy } = require("passport-jwt");
const { PrismaClient } = require("@prisma/client/");
const passport = require("passport");

const prisma = new PrismaClient();

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  "protected",
  new Strategy(options, async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (user) return done(null, user);
      else {
        return done(null, false);
      }
    } catch (err) {
      return done(err);
    }
  }),
);

const authenticateJWT = passport.authenticate("protected", { session: false });

module.exports = { authenticateJWT };
