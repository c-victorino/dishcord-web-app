require("dotenv").config();
const NO_RESULTS = "no results returned"; // reject message
const Sequelize = require("sequelize");

// Initialize Sequelize with provided connection string and options.
// Uses ElephantSQL connection string
const sequelize = new Sequelize(process.env.ELEPHANTSQL_CONNECTION_STRING, {
  dialectOptions: {
    ssl: { rejectUnauthorized: false },
  },
  query: { raw: true },
  logging: false,
});

// Defines the Post model with Sequelize
const Post = sequelize.define("Post", {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  isUpdated: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
  userOrigin: Sequelize.STRING,
});

// Defines Category model with Sequelize.
const Category = sequelize.define("Category", {
  category: Sequelize.STRING,
  userOrigin: Sequelize.STRING, // use for identifying creator
});

// Define the relationship between Post and Category models.
// Associates category field in Post with the Category model.
Post.belongsTo(Category, { foreignKey: "category" });

// Initializes the database by synchronizing Sequelize models.
async function initialize() {
  try {
    await sequelize.sync();
  } catch (err) {
    throw new Error("unable to sync the database");
  }
}

/**
 * Fetches all posts and modifies their 'userOrigin' property based on the provided userId.
 * @param {string} userId - The user ID to compare against 'userOrigin' property.
 * @returns {Promise<Array>} A promise that resolves to an array of modified posts.
 */
async function getAllPosts(userId) {
  try {
    const posts = await Post.findAll();
    // Modify 'userOrigin' property of each post based on userId
    posts.forEach((post) => (post.userOrigin = post.userOrigin === userId));

    return posts;
  } catch (err) {
    // Handle any errors and throw a custom error message if no results are found
    throw new Error(NO_RESULTS);
  }
}

// Retrieves all categories from the PostgreSQL database
async function getCategories(userId) {
  try {
    const categories = await Category.findAll();
    categories.forEach((obj) => (obj.userOrigin = obj.userOrigin === userId));

    return categories;
  } catch (err) {
    throw new Error(NO_RESULTS);
  }
}

// get post who's category value is the value passed to the function
async function getPostsByCategory(category, userId) {
  try {
    const posts = await Post.findAll({
      where: {
        category,
      },
    });
    posts.forEach((obj) => (obj.userOrigin = obj.userOrigin === userId));

    return posts;
  } catch (err) {
    throw new Error(NO_RESULTS);
  }
}

// get post that contains postDate value greater than or equal to the minDateStr
async function getPostsByMinDate(minDateStr, userId) {
  try {
    const { gte } = Sequelize.Op;
    const posts = await Post.findAll({
      where: {
        postDate: {
          [gte]: new Date(minDateStr),
        },
      },
    });
    posts.forEach((obj) => (obj.userOrigin = obj.userOrigin === userId));

    return posts;
  } catch (err) {
    throw new Error(NO_RESULTS);
  }
}

// get post who's id value is the value passed to the function
async function getPostById(id) {
  try {
    const post = await Post.findOne({
      where: { id },
    });

    return post;
  } catch (err) {
    throw new Error(NO_RESULTS);
  }
}

// create and saves the postData to a PostgreSQL database
async function addPost(postData, userId) {
  try {
    // Ensure value is correct when user toggled or not the
    // published property in the form
    postData.published = postData.published ? true : false;

    // make any blank values be null when user did not input a value on a field
    for (let key in postData) {
      if (postData[key] === "") {
        postData[key] = null;
      }
    }
    // assign userOrigin as the userID
    postData.userOrigin = userId;

    const newPost = await Post.create(postData);

    return newPost;
  } catch (err) {
    throw new Error("unable to create post");
  }
}

/**
 * Update a post with the specified data.
 * @param {number} postId - The ID of the post to update.
 * @param {object} postData - The data to update the post with.
 */
async function updatePost(postId, postData) {
  try {
    // Set the 'isUpdated' field to true
    postData.isUpdated = true;

    // Convert 'published' to a boolean value (true or false)
    postData.published = postData.published ? true : false;

    // Update the post data in the database based on the post ID
    await Post.update(postData, { where: { id: postId } });
  } catch (err) {
    throw err;
  }
}

// create and saves the categoryData to a PostgreSQL database
async function addCategory(categoryData, userId) {
  try {
    categoryData.userOrigin = userId;
    const newCategory = await Category.create(categoryData);
    return newCategory;
  } catch (err) {
    throw new Error("unable to create category");
  }
}

// deletes specific category by its id
async function deleteCategoryById(id, userId) {
  try {
    Category.destroy({
      where: { id, userOrigin: userId },
    });
  } catch (err) {
    throw new Error("Unable to Remove Category / Category not found");
  }
}

// deletes specific Post by its id
async function deletePostById(id, userId) {
  try {
    Post.destroy({
      where: { id, userOrigin: userId },
    });
  } catch (err) {
    throw new Error("Unable to Remove Post / Post not found");
  }
}

// Retrieve and return the original author's user ID for a specific post.
async function getPostOrigin(postId) {
  try {
    const origin = await Post.findByPk(postId, {
      attributes: ["userOrigin"],
    });
    return origin ? origin.userOrigin : null;
  } catch (err) {}
}

/**
 * Calculate and return an array of page numbers for pagination.
 * @param {number} postPerPage - The number of posts displayed per page.
 * @param {string|null} category - Optional category filter for counting posts.
 */
async function getPaginationPageCount(postPerPage, category) {
  try {
    // Count the total number of posts, optionally filtered by category
    const total = category
      ? await Post.count({ where: { category: category } })
      : await Post.count();

    // Initialize an array to store page numbers
    const pageNumbers = [];

    // Calculate the number of pages needed based on post count and per-page limit
    const pageCount = Math.ceil(total / postPerPage);

    // Generate an array of page numbers from 1 to pageCount
    for (let i = 1; i <= pageCount; i++) {
      pageNumbers.push(i);
    }

    // Return the array of page numbers
    return pageNumbers;
  } catch (err) {
    throw new Error("Error on calculating pagination page count");
  }
}

/**
 * Retrieve and return a paginated list of published posts in a specific category.
 * @param {string} category - The category to filter posts by.
 * @param {number} postPerPage - The number of posts to display per page.
 * @param {number} currentPage - The current page number.
 * @returns {Promise<Array>} Array of paginated posts.
 */
async function getPaginatedPostByCategory(category, postPerPage, currentPage) {
  // Calculate the offset based on the current page and posts per page
  const offset = (currentPage - 1) * postPerPage;

  try {
    // Fetch paginated posts from the database, filtered by category and published status
    const posts = await Post.findAll({
      limit: postPerPage,
      offset: offset,
      where: {
        published: true,
        category: category,
      },
    });

    return posts;
  } catch (err) {
    throw new Error("Error fetching paginated posts by category");
  }
}

// Retrieve and return a paginated list of published posts.
async function getPaginatedPost(postPerPage, currentPage) {
  // Calculate the offset based on the current page and posts per page
  const offset = (currentPage - 1) * postPerPage;

  try {
    // Fetch paginated posts from the database
    const paginatedPosts = await Post.findAll({
      limit: postPerPage,
      offset: offset,
      where: {
        published: true,
      },
      order: [["updatedAt", "DESC"]],
    });

    // Return the paginated posts
    return paginatedPosts;
  } catch (err) {
    throw new Error("Error fetching paginated posts");
  }
}

// Retrieve and return the count of categories.
async function getCategoryCount() {
  try {
    const categoryCount = await Category.count();
    return categoryCount;
  } catch (err) {
    throw new Error("Error fetching number of categories");
  }
}

// Retrieve and return the count of published posts.
async function getPostCount() {
  try {
    const postCount = await Post.count({ where: { published: true } });
    return postCount;
  } catch (err) {
    throw new Error("Error fetching number of posts");
  }
}

module.exports = {
  initialize,
  getAllPosts,
  getCategories,
  getPostsByCategory,
  getPostsByMinDate,
  getPostById,
  addPost,
  addCategory,
  deleteCategoryById,
  deletePostById,
  getPostOrigin,
  updatePost,
  getPaginationPageCount,
  getPaginatedPostByCategory,
  getPaginatedPost,
  getPostCount,
  getCategoryCount,
};
