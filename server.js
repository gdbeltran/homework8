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

const BowlingSeriesSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    league_name: { type: String, required: true },
    date: { type: Date, required: true },
    game1: { type: Number, required: true },
    game2: { type: Number, required: true },
    game3: { type: Number, required: true },
    total: { type: Number, required: true },
    average: { type: Number, required: true },
  },
  { collection: "Series" }
);

const userSchema = new mongoose.Schema(
  {
    username: String,
    password: String,
    first_name: String,
    last_name: String,
    leagues: [String],
  },
  { collection: "Users" }
);

userSchema.methods.comparePassword = async function (candidatePassword) {
  return candidatePassword === this.password;
};

const BowlingSeries = mongoose.model("Series", BowlingSeriesSchema);
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
    const games = await BowlingSeries.find({ user: req.user._id }).sort({
      date: "desc",
    });
    res.render("index", { games });
  } catch (error) {
    console.error("Error fetching games:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/settings", isAuthenticated, (req, res) => {
  res.render("settings", { user: req.user });
});

app.post("/settings", isAuthenticated, async (req, res) => {
  const { first_name, last_name, league_names } = req.body;

  // Validate the input...

  req.user.first_name = first_name;
  req.user.last_name = last_name;
  req.user.leagues = Array.isArray(league_names)
    ? league_names
    : [league_names];
  await req.user.save();

  res.redirect("/settings");
});

app.post("/add", isAuthenticated, async (req, res) => {
  const { game1, game2, game3, league_name, date } = req.body;

  try {
    if (!game1 || !game2 || !game3 || !league_name || !date) {
      throw new Error("All fields are required.");
    }

    const total = parseInt(game1) + parseInt(game2) + parseInt(game3);
    const average = total / 3;

    const formattedDate = new Date(date);

    const newGame = new BowlingSeries({
      user: req.user._id,
      league_name,
      date: formattedDate,
      game1,
      game2,
      game3,
      total,
      average,
    });
    await newGame.save();

    // Redirect to the "view.ejs" page after saving the game scores
    res.redirect("/view");
  } catch (error) {
    console.error("Error adding game:", error.message);
    res.status(400).send("Bad Request");
  }
});

app.get("/view", isAuthenticated, async (req, res) => {
  try {
    // Fetch all series tied to the user
    const series = await BowlingSeries.find({ user: req.user._id }).sort({
      date: "desc",
    });

    // Calculate totals and averages
    const totalScores = series.reduce((sum, series) => sum + series.total, 0);
    const averageScore = totalScores / (series.length * 3);

    // Render the "view.ejs" page and pass the data to it
    res.render("view", { series, totalScores, averageScore });
  } catch (error) {
    console.error("Error fetching game series data:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/enter", isAuthenticated, (req, res) => {
  // Render the "enter.ejs" page
  res.render("enter", { user: req.user });
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
  req.logout();
  res.redirect("/login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const {
    username,
    password,
    confirm_password,
    first_name,
    last_name,
    league_name1,
    league_name2,
    league_name3,
    league_name4,
    league_name5,
  } = req.body;

  try {
    if (
      !username ||
      !password ||
      !confirm_password ||
      !first_name ||
      !last_name ||
      !league_name1
    ) {
      throw new Error("All fields are required.");
    }

    if (password !== confirm_password) {
      throw new Error("Passwords do not match.");
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new Error("Username already exists.");
    }

    const leagues = [league_name1];
    if (league_name2) leagues.push(league_name2);
    if (league_name3) leagues.push(league_name3);
    if (league_name4) leagues.push(league_name4);
    if (league_name5) leagues.push(league_name5);

    const user = new User({
      username,
      password,
      first_name,
      last_name,
      leagues,
    });
    await user.save();

    res.redirect("/login");
  } catch (error) {
    console.error("Error registering user:", error.message);
    res.status(400).send(error.message);
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
