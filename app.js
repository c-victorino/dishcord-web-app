const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");

const stripJs = require("strip-js");

const app = express();
const authRoutes = require("./routes/authRoutes.js");
const publicRoutes = require("./routes/publicRoutes.js");
const userRoutes = require("./routes/userRoutes.js");

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(authRoutes);
app.use(publicRoutes);
app.use(userRoutes);

// updates app.locals with the active route and viewing category,
// enabling dynamic rendering of navigation elements and content in views/templates.
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

// Serve static folder
app.use(express.static(path.join(__dirname, "public")));

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

// Middleware to make session data available to Handlebars templates
// This middleware sets 'res.locals.session' to the user's session object,
// allowing access to user related data in hbs views templates.
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// automatically generates correct <li> element and adds class "active" if provided URL matches active route.
// {{#navLink "/about"}}About{{/navLink}}
const navLink = (url, options) => {
  const isActive = url === app.locals.activeRoute;
  const navClass = isActive ? "active" : "";

  return `
    <li class="nav-item">
      <a href="${url}" class="nav-link ${navClass}">
        ${options.fn(this)}
      </a>
    </li>
  `;
};

// removes unwanted JavaScript code from post body string by using a custom package: strip-js
// {{#safeHTML someString}}{{/safeHTML}}
const safeHTML = function (context) {
  return stripJs(context);
};

// Keep date formatting consistent in views.
// {{#formatDate postDate}}{{/formatDate}}
const formatDate = (dateObj) => dateObj.toISOString().slice(0, 10);

const ifEquals = function (arg1, arg2, options) {
  if (arg1 === arg2) {
    // Render content inside the {{#ifEquals}} block
    return options.fn(this);
  }
};

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    helpers: {
      navLink,
      safeHTML,
      formatDate,
      ifEquals,
    },
  })
);

// Sets view engine to use Handlebars for rendering dynamic templates
app.set("view engine", ".hbs");

// Middleware for handling 404 errors and rendering 404 page
app.use((req, res) => res.status(404).render("404"));

module.exports = app;
