const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const flash = require("connect-flash");
const connectMongo = require("connect-mongo");
require("dotenv").config();

const app = express();
const port = 3000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

const bowlingGameSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  game1: { type: Number, required: true },
  game2: { type: Number, required: true },
  game3: { type: Number, required: true },
  total: { type: Number, required: true },
  average: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
  },
  { collection: "Users" }
);

userSchema.methods.comparePassword = async function (candidatePassword) {
  return candidatePassword === this.password;
};

const BowlingGame = mongoose.model("BowlingGame", bowlingGameSchema);
const User = mongoose.model("User", userSchema);

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });

      if (!user) {
        return done(null, false, { message: "Incorrect username." });
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "regadera-squirrel",
    resave: false,
    saveUninitialized: true,
    store: new (connectMongo(session))({
      mongooseConnection: mongoose.connection,
    }),
  })
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", isAuthenticated, async (req, res) => {
  try {
    const games = await BowlingGame.find({ user: req.user._id }).sort({
      date: "desc",
    });
    res.render("index", { games });
  } catch (error) {
    console.error("Error fetching games:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", isAuthenticated, async (req, res) => {
  const { game1, game2, game3 } = req.body;

  try {
    if (!game1 || !game2 || !game3) {
      throw new Error("All game scores are required.");
    }

    const total = parseInt(game1) + parseInt(game2) + parseInt(game3);
    const average = total / 3;

    const newGame = new BowlingGame({
      user: req.user._id,
      game1,
      game2,
      game3,
      total,
      average,
    });
    await newGame.save();

    // Redirect to the "series.ejs" page after saving the game scores
    res.redirect("/series");
  } catch (error) {
    console.error("Error adding game:", error.message);
    res.status(400).send("Bad Request");
  }
});

app.get("/series", isAuthenticated, async (req, res) => {
  try {
    // Fetch all games tied to the user
    const games = await BowlingGame.find({ user: req.user._id }).sort({
      date: "desc",
    });

    // Calculate totals and averages
    const totalScores = games.reduce((sum, game) => sum + game.total, 0);
    const averageScore = totalScores / games.length;

    // Render the "series.ejs" page and pass the data to it
    res.render("series", { games, totalScores, averageScore });
  } catch (error) {
    console.error("Error fetching game series data:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/enter", isAuthenticated, (req, res) => {
  // Render the "enter.ejs" page
  res.render("enter");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send("Error logging out");
    }
    res.redirect("/login");
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      throw new Error("Username and password are required.");
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new Error("Username already exists.");
    }

    const newUser = new User({ username, password });
    await newUser.save();

    res.redirect("/login");
  } catch (error) {
    console.error("Error registering user:", error.message);
    res.status(400).send("Bad Request");
  }
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
