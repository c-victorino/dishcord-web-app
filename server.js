const authData = require("./auth-service.js");
const clientSessions = require("client-sessions");
const express = require("express");
const app = express();
const exphbs = require("express-handlebars");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const stripJs = require("strip-js");
const blogService = require("./blog-service.js");
const HTTP_PORT = process.env.PORT || 8080;

// middleware
app.use(express.urlencoded({ extended: true }));

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

// static folder
app.use(express.static(path.join(__dirname, "public")));

// client-sessions configuration
app.use(
  clientSessions({
    cookieName: "session", // this is the object name that will be added to 'req'
    secret: "", // this should be a long un-guessable string.
    duration: 15 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
  })
);

// used to conditionally hide/show elements to the user
// depending on whether they're currently logged in
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Handlebars configuration and helper functions
// automatically generates correct <li> element and adds class "active" if provided URL matches active route.
// {{#navLink "/about"}}About{{/navLink}}
const navLink = function (url, options) {
  return (
    `<li class="nav-item">` +
    `<a href="${url}"` +
    (url == app.locals.activeRoute
      ? ' class="nav-link active " '
      : ' class="nav-link" ') +
    `>${options.fn(this)}</a></li>`
  );
};

// removes unwanted JavaScript code from post body string by using a custom package: strip-js
// {{#safeHTML someString}}{{/safeHTML}}
const safeHTML = function (context) {
  return stripJs(context);
};

// formatDate to keep dates formatting consistent in views.
// {{#formatDate postDate}}{{/formatDate}}
const formatDate = function (dateObj) {
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString();
  const day = dateObj.getDate().toString();
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    helpers: {
      navLink,
      safeHTML,
      formatDate,
    },
  })
);

app.set("view engine", ".hbs");

// cloudinary configuration
cloudinary.config({
  cloud_name: "",
  api_key: "",
  api_secret: "",
  secure: true,
});

// multer setup
const upload = multer(); // no { storage: storage } since we are not using disk storage

// checks if a user is logged in. Can be used in any route that
// needs to be protected against unauthenticated access
function ensureLogin(req, res, next) {
  !req.session.user ? res.redirect("/login") : next();
}

// routes
// home route
app.get("/", (req, res) => res.redirect("/about"));

// route about
app.get("/about", (req, res) => res.render("about"));

// route blog
app.get("/blog", async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};

  try {
    // declare empty array to hold "post" objects
    let posts = [];

    // if there's a "category" query, filter the returned posts by category
    // otherwise obtain the published "posts"
    posts = req.query.category
      ? await blogService.getPublishedPostsByCategory(req.query.category)
      : await blogService.getPublishedPosts();

    // sort the published posts by postDate
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

    // get the latest post from the front of the list (element 0)
    let post = posts[0];

    // store the "posts" and "post" data in the viewData object (to be passed to the view)
    viewData.posts = posts;
    viewData.post = post;
  } catch (err) {
    viewData.message = "no results";
  }

  try {
    // Obtain the full list of "categories"
    let categories = await blogService.getCategories();

    // store the "categories" data in the viewData object (to be passed to the view)
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = "no results";
  }

  // render the "blog" view with all of the data (viewData)
  res.render("blog", { data: viewData });
});

// route posts / post
app.get("/posts", ensureLogin, (req, res) => {
  const category = req.query.category;
  const minDateStr = req.query.minDate;
  blogService
    .getAllPosts()
    .then((data) => {
      if (category) {
        return blogService.getPostsByCategory(category);
      } else if (minDateStr) {
        return blogService.getPostsByMinDate(minDateStr);
      } else {
        return Promise.resolve(data);
      }
    })
    .then((result) => {
      if (!result.length) {
        return Promise.reject("no results");
      }
      res.render("posts", { posts: result });
    })
    .catch((err) => res.render("posts", { message: err }));
});

app.get("/post/:id", ensureLogin, (req, res) => {
  blogService
    .getPostById(req.params.id)
    .then((result) => res.json(result))
    .catch((err) => res.json({ message: err }));
});

app.get("/posts/add", ensureLogin, (req, res) => {
  blogService
    .getCategories()
    .then((data) => res.render("addPost", { categories: data }))
    .catch((err) => res.render("addPost", { categories: [] }));
});

app.post(
  "/posts/add",
  ensureLogin,
  upload.single("featureImage"),
  (req, res) => {
    if (req.file) {
      let streamUpload = (req) => {
        return new Promise((resolve, reject) => {
          let stream = cloudinary.uploader.upload_stream((error, result) => {
            result ? resolve(result) : reject(error);
          });

          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };

      async function upload(req) {
        let result = await streamUpload(req);
        return result;
      }

      upload(req).then((uploaded) => {
        req.body.featureImage = uploaded.url;
        blogService
          .addPost(req.body)
          .then(() => res.redirect("/posts"))
          .catch((err) => res.json({ message: err }));
      });
    } else {
      // Handle the case when no image is uploaded
      req.body.featureImage = null;
      blogService
        .addPost(req.body)
        .then(() => res.redirect("/posts"))
        .catch((err) => res.json({ message: err }));
    }
  }
);

app.get("/posts/delete/:id", ensureLogin, (req, res) => {
  blogService
    .deletePostById(req.params.id)
    .then(() => res.redirect("/posts"))
    .catch((err) => res.status(500).send(err));
});

// route blog
app.get("/blog/:id", async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};

  try {
    // declare empty array to hold "post" objects
    let posts = [];

    // if there's a "category" query, filter the returned posts by category
    // otherwise obtain the published "posts"
    posts = req.query.category
      ? await blogService.getPublishedPostsByCategory(req.query.category)
      : await blogService.getPublishedPosts();

    // sort the published posts by postDate
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    // store the "posts" and "post" data in the viewData object (to be passed to the view)
    viewData.posts = posts;
  } catch (err) {
    viewData.message = "no results";
  }

  try {
    // Obtain the post by "id"
    viewData.post = await blogService.getPostById(req.params.id);
  } catch (err) {
    viewData.message = "no results";
  }

  try {
    // Obtain the full list of "categories"
    let categories = await blogService.getCategories();
    // store the "categories" data in the viewData object (to be passed to the view)
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = "no results";
  }

  // render the "blog" view with all of the data (viewData)
  res.render("blog", { data: viewData });
});

// route categories
app.get("/categories", ensureLogin, (req, res) => {
  blogService
    .getCategories()
    .then((data) => {
      if (!data.length) {
        return Promise.reject("no results");
      }
      res.render("categories", { categories: data });
    })
    .catch((err) => res.render("categories", { message: err }));
});

app.get("/categories/add", ensureLogin, (req, res) =>
  res.render("addCategory")
);

app.post("/categories/add", ensureLogin, (req, res) => {
  blogService
    .addCategory(req.body)
    .then(() => res.redirect("/categories"))
    .catch((err) => res.json({ message: err }));
});

app.get("/categories/delete/:id", ensureLogin, (req, res) => {
  blogService
    .deleteCategoryById(req.params.id)
    .then(() => res.redirect("/categories"))
    .catch((err) => res.status(500).send(err));
});

// route login
app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
  req.body.userAgent = req.get("User-Agent");
  authData
    .checkUser(req.body)
    .then((user) => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory,
      };

      res.redirect("/posts");
    })
    .catch((err) =>
      res.render("login", { errorMessage: err, userName: req.body.userName })
    );
});

// route logout
app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/");
});

// route userHistory
app.get("/userHistory", ensureLogin, (req, res) => res.render("userHistory"));

// route register
app.get("/register", (req, res) => res.render("register"));

app.post("/register", (req, res) => {
  authData
    .registerUser(req.body)
    .then(() => res.render("register", { successMessage: "User created" }))
    .catch((err) =>
      res.render("register", { errorMessage: err, userName: req.body.userName })
    );
});

// handle unknown routes
app.use((req, res) => res.status(404).render("404"));

// server start
blogService
  .initialize()
  .then(authData.initialize)
  .then((result) =>
    app.listen(
      HTTP_PORT,
      console.log("Express http server listening on " + HTTP_PORT)
    )
  )
  .catch((error) => console.log(error));
