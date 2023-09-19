require("dotenv").config();
const authData = require("./auth-service.js");
const session = require("express-session");
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

// cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// multer instance for handling file uploads
const upload = multer(); // not using disk storage

// checks if a user is logged in. Can be used in any route that
// needs to be protected against unauthenticated access
function ensureLogin(req, res, next) {
  !req.session.user ? res.redirect("/login") : next();
}

// Routes
//
// Redirect to the "/home" page
app.get("/", (req, res) => res.redirect("/home"));

app.get("/home", async (req, res) => {
  let viewData = {};

  try {
    const userCount = await authData.getUserCount();
    viewData.userCount = userCount;
  } catch (err) {
    viewData.userErr = err;
  }

  try {
    const categoryCount = await blogService.getCategoryCount();
    viewData.categoryCount = categoryCount;
  } catch (err) {
    viewData.categoryErr = err;
  }

  try {
    const postCount = await blogService.getPostCount();
    viewData.postCount = postCount;
  } catch (err) {
    viewData.postErr = err;
  }

  res.render("home", { enable: true, view: viewData });
});

// route blog
app.get("/blog", async (req, res) => {
  // Initialize view data object
  let viewData = {};

  // Pagination setup
  const postPerPage = 6;
  const currentPage = req.query.page || 1;
  const qCategory = req.query.category;

  viewData.currentPage = currentPage;
  viewData.qCategory = qCategory;

  // Determine total number of pages for pagination
  try {
    const totalPage = await blogService.getPaginationPageCount(
      postPerPage,
      qCategory
    );

    if (totalPage.length > 1) {
      viewData.totalPage = totalPage;
    }
  } catch (err) {
    viewData.pageMessage = "Unable to determine needed pages";
  }

  // Retrieve paginated posts
  try {
    const posts = qCategory
      ? await blogService.getPaginatedPostByCategory(
          qCategory,
          postPerPage,
          currentPage
        )
      : await blogService.getPaginatedPost(postPerPage, currentPage);

    viewData.posts = posts;
  } catch (err) {
    viewData.postMessage = "No results";
  }

  // Retrieve and sort categories alphabetically
  try {
    const categories = await blogService.getCategories();
    categories.sort((a, b) => a.category.localeCompare(b));
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesErrMessage = "No Categories";
  }

  // Render the "blog" view with view data
  res.render("blog", { data: viewData });
});

// Handle GET request to "/posts" route with authentication
app.get("/posts", ensureLogin, async (req, res) => {
  try {
    // Get the user ID from the session
    const userId = req.session.user.id;
    // Extract query parameters for filtering posts
    const category = req.query.category;
    const minDateStr = req.query.minDate;
    // Fetch all posts associated with the user
    const allPosts = await blogService.getAllPosts(userId);

    let filteredPosts = allPosts;

    // Filter posts by category if category is specified in the query
    if (category) {
      filteredPosts = await blogService.getPostsByCategory(category, userId);
    }
    // Filter posts by minimum date if minDateStr is specified in the query
    else if (minDateStr) {
      filteredPosts = await blogService.getPostsByMinDate(minDateStr, userId);
    }

    // If no results are found, reject the promise with an error message
    if (!filteredPosts.length) {
      return Promise.reject("no results");
    }

    // Render the "posts" template with the filtered posts data
    res.render("posts", { posts: filteredPosts });
  } catch (error) {
    res.render("posts", { message: error });
  }
});

// Handle GET request to "/post/:id" route with authentication
app.get("/post/:id", ensureLogin, async (req, res) => {
  try {
    // Attempt to asynchronously fetch a post by ID from the blogService
    const post = await blogService.getPostById(req.params.id);
    // Send a JSON response with the retrieved post data
    res.json(post);
  } catch (error) {
    // If an error occurs during the process, send a JSON response with an error message
    res.json({ message: error });
  }
});

// Handle GET request to "/posts/add"
app.get("/posts/add", ensureLogin, async (req, res) => {
  try {
    const categories = await blogService.getCategories();
    res.render("addPost", { categories });
  } catch (error) {
    res.render("addPost", { categories: [] });
  }
});

// Handle the HTTP POST request for adding a new post
app.post(
  "/posts/add",
  ensureLogin,
  upload.single("featureImage"), // Handle file upload for a feature image
  async (req, res) => {
    try {
      // Extract the user ID from the session
      const userId = req.session.user.id;

      // If a file was uploaded, process and store it
      if (req.file) {
        const uploaded = await uploadImage(req.file.buffer);
        req.body.featureImage = uploaded.url;
      } else {
        // No file uploaded, set featureImage to null
        req.body.featureImage = null;
      }

      // Add the post to the blog service using the request body & user ID
      await blogService.addPost(req.body, userId);
      res.redirect("/posts");
    } catch (err) {
      res.json({ message: err });
    }
  }
);

function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// Handle the route for editing a post by ID, ensuring the user is logged in
app.get("/posts/edit/:id", ensureLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const postId = req.params.id;
    // Retrieve the post by ID
    const post = await blogService.getPostById(postId);
    const categories = await blogService.getCategories(userId);
    res.render("addPost", { update: post, categories: categories, postId });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Handle the route for editing a post by ID
app.post(
  "/posts/edit/:id",
  ensureLogin, // Ensure the user is logged in before allowing access
  upload.single("featureImage"), // Handle file upload for a feature image
  async (req, res) => {
    try {
      // Extract the user ID from the session
      const userId = req.session.user.id;

      // Get the original author's user ID for the post being edited
      const postOrigin = await blogService.getPostOrigin(req.params.id);

      // Check if the current user is the author of the post
      if (postOrigin === userId) {
        // If file was uploaded, store it
        if (req.file) {
          const uploaded = await uploadImage(req.file.buffer);
          req.body.featureImage = uploaded.url;
        }

        // Update the post using the request body and post ID
        await blogService.updatePost(req.params.id, req.body);

        // Redirect to the "/posts" page after successfully editing the post
        res.redirect("/posts");
      }
    } catch (err) {
      // Handle any errors by logging them to the console
      console.error(err);
    }
  }
);

// Handle the route for deleting a post by ID
app.get("/posts/delete/:id", ensureLogin, async (req, res) => {
  try {
    // Get the user's ID from the session
    const userId = req.session.user.id;
    // Delete the post by ID, passing the user's ID for authorization
    await blogService.deletePostById(req.params.id, userId);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send(err);
  }
});

// Route handler for displaying the list of categories, also ensuring the user is logged in
app.get("/categories", ensureLogin, async (req, res) => {
  try {
    // Get the user's ID from the session
    const userId = req.session.user.id;
    // Retrieve the list of categories
    const categoryList = await blogService.getCategories(userId);
    if (!categoryList.length) {
      return Promise.reject("no results");
    }
    res.render("categories", { categories: categoryList });
  } catch (err) {
    res.render("categories", { message: err });
  }
});

// Render the "addCategory" page with authentication check
app.get("/categories/add", ensureLogin, (req, res) =>
  res.render("addCategory")
);

// Post route to handle adding new category
app.post("/categories/add", ensureLogin, async (req, res) => {
  try {
    // Get the user's ID from the session
    const userId = req.session.user.id;
    // Add new category with the provided data and user ID
    await blogService.addCategory(req.body, userId);
    res.redirect("/categories");
  } catch (err) {
    res.json({ message: err });
  }
});

// GET route to handle the deletion of a category by ID
app.get("/categories/delete/:id", ensureLogin, async (req, res) => {
  try {
    // Get the user's ID from the session
    const userId = req.session.user.id;
    // Delete the category by ID, and pass the user's ID for authorization
    await blogService.deleteCategoryById(req.params.id, userId);
    res.redirect("/categories");
  } catch (err) {
    res.status(500).send(err);
  }
});

// Render the "login" page
app.get("/login", (req, res) => res.render("login"));

// POST route to handle user login
app.post("/login", async (req, res) => {
  try {
    // Authenticate the user using provided credentials
    const user = await authData.checkUser(req.body);
    // If authentication is successful, create a session
    req.session.user = {
      id: user._id.toString(),
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory,
    };
    res.redirect("/posts");
  } catch (err) {
    res.render("login", { errorMessage: err, userName: req.body.userName });
  }
});

// Route for logging out a user
app.get("/logout", (req, res) => {
  // Remove session data associated with the user's session
  req.session.destroy();
  // Redirect the user to the home page after logging out
  res.redirect("/");
});

// Render userHistory view for current authenticated user
app.get("/userHistory", ensureLogin, (req, res) => res.render("userHistory"));

// Render "register" template when GET request is made to "/register"
app.get("/register", (req, res) => res.render("register"));

// Handle registration form submission via POST request
app.post("/register", async (req, res) => {
  try {
    // Attempt to register user with data from request body
    const result = await authData.registerUser(req.body);
    // If successful, render the register view with success message
    res.render("register", { successMessage: result });
  } catch (err) {
    res.render("register", { errorMessage: err, userName: req.body.userName });
  }
});

// Middleware for handling 404 errors and rendering 404 page
app.use((req, res) => res.status(404).render("404"));

// Initialize services and start the Express server.
(async () => {
  try {
    // Initialize the blogService to set up database connections and models.
    await blogService.initialize();
    // Initialize authData service, which sets up authentication related configurations.
    await authData.initialize();
    app.listen(
      HTTP_PORT,
      console.log("Express http server listening on", HTTP_PORT)
    );
  } catch (err) {
    console.error("Error occurred:", err);
  }
})();
