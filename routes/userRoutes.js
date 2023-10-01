const express = require("express");
const router = express.Router();
const multer = require("multer");
const blogService = require("../services/blog-service.js");
const cloudinaryUploader = require("../services/cloudinary-service.js");

// multer instance for handling file uploads
const upload = multer(); // not using disk storage

// checks if a user is logged in. Can be used in any route that
// needs to be protected against unauthenticated access
function ensureLogin(req, res, next) {
  !req.session.user ? res.redirect("/login") : next();
}

// Handle GET request to "/posts" route with authentication
router.get("/posts", ensureLogin, async (req, res) => {
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
router.get("/post/:id", ensureLogin, async (req, res) => {
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
router.get("/posts/add", ensureLogin, async (req, res) => {
  try {
    const categories = await blogService.getCategories();
    res.render("addPost", { categories });
  } catch (error) {
    res.render("addPost", { categories: [] });
  }
});

// Handle the HTTP POST request for adding a new post
router.post(
  "/posts/add",
  ensureLogin,
  upload.single("featureImage"), // Handle file upload for a feature image
  async (req, res) => {
    try {
      // Extract the user ID from the session
      const userId = req.session.user.id;

      // If a file was uploaded, process and store it
      if (req.file) {
        const uploaded = await cloudinaryUploader.uploadImage(req.file.buffer);
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

// Handle the route for editing a post by ID, ensuring the user is logged in
router.get("/posts/edit/:id", ensureLogin, async (req, res) => {
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
router.post(
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
          const uploaded = await cloudinaryUploader.uploadImage(
            req.file.buffer
          );
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
router.get("/posts/delete/:id", ensureLogin, async (req, res) => {
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
router.get("/categories", ensureLogin, async (req, res) => {
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
router.get("/categories/add", ensureLogin, (req, res) =>
  res.render("addCategory")
);

// Post route to handle adding new category
router.post("/categories/add", ensureLogin, async (req, res) => {
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
router.get("/categories/delete/:id", ensureLogin, async (req, res) => {
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

// Render userHistory view for current authenticated user
router.get("/userHistory", ensureLogin, (req, res) =>
  res.render("userHistory")
);

module.exports = router;
