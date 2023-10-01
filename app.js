const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");
const hbsHelpers = require("./helpers/handlebars-helpers.js");

const app = express();

// Middleware for parsing URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Session middleware configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 15 * 60 * 1000, // 15 minutes
    },
  })
);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Middleware to make session data available to Handlebars templates
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware to update app.locals with the active route
app.use(function (req, res, next) {
  let route = req.path.substring(1);
  app.locals.activeRoute =
    "/" +
    (isNaN(route.split("/")[1])
      ? route.replace(/\/(?!.*)/, "")
      : route.replace(/\/(.*)/, ""));
  app.locals.viewingCategory = req.query.category;
  next();
});

// Route files
const authRoutes = require("./routes/authRoutes.js");
const publicRoutes = require("./routes/publicRoutes.js");
const userRoutes = require("./routes/userRoutes.js");

// Configure Handlebars engine with custom helpers
app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    helpers: hbsHelpers, // Custom Helpers from imported module
  })
);

// Set the view engine to use Handlebars for rendering templates
app.set("view engine", ".hbs");

// Route files as middleware
app.use(authRoutes);
app.use(publicRoutes);
app.use(userRoutes);

// Middleware for handling 404 errors and rendering a 404 page
app.use((req, res) => res.status(404).render("404"));

module.exports = app;
