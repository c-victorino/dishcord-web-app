const express = require("express");
const router = express.Router();
const blogService = require("../services/blog-service.js");
const authData = require("../services/auth-service.js");
// Redirect to the "/home" page
router.get("/", (req, res) => res.redirect("/home"));

router.get("/home", async (req, res) => {
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
router.get("/blog", async (req, res) => {
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

module.exports = router;
