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

const bowlingScoreSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  score: { type: Number, required: true },
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

const BowlingScore = mongoose.model("BowlingScore", bowlingScoreSchema);
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
    const scores = await BowlingScore.find({ user: req.user._id }).sort({
      date: "desc",
    });
    res.render("index", { scores });
  } catch (error) {
    console.error("Error fetching scores:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", isAuthenticated, async (req, res) => {
  const { score } = req.body;

  try {
    if (!score) {
      throw new Error("Score is required.");
    }

    const newScore = new BowlingScore({ user: req.user._id, score });
    await newScore.save();

    res.redirect("/");
  } catch (error) {
    console.error("Error adding score:", error.message);
    res.status(400).send("Bad Request");
  }
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
