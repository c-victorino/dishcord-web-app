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
  userOrigin: Sequelize.STRING,
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
    posts.forEach((post) => (post.userOrigin = post.userOrigin === userId));
    return posts;
  } catch (err) {
    throw new Error(NO_RESULTS);
  }
}

// Retrieves all categories from the PostgreSQL database
function getCategories(userId) {
  return new Promise((resolve, reject) => {
    Category.findAll()
      .then((categories) => {
        // make true if user is the creator of the category
        categories.forEach(
          (obj) => (obj.userOrigin = obj.userOrigin === userId)
        );

        resolve(categories);
      })
      .catch((err) => reject(NO_RESULTS));
  });
}

// get post who's category value is the value passed to the function
function getPostsByCategory(category, userId) {
  return new Promise((resolve, reject) => {
    Post.findAll({
      where: {
        category,
      },
    })
      .then((posts) => {
        posts.forEach((obj) => (obj.userOrigin = obj.userOrigin === userId));
        resolve(posts);
      })
      .catch((err) => reject(NO_RESULTS));
  });
}

// get post that contains postDate value greater than or equal to the minDateStr
function getPostsByMinDate(minDateStr) {
  return new Promise((resolve, reject) => {
    const { gte } = Sequelize.Op;
    Post.findAll({
      where: {
        postDate: {
          [gte]: new Date(minDateStr),
        },
      },
    })
      .then((posts) => {
        posts.forEach((obj) => (obj.userOrigin = obj.userOrigin === userId));
        resolve(posts);
      })
      .catch((err) => reject(NO_RESULTS));
  });
}

// get post who's id value is the value passed to the function
function getPostById(id) {
  return new Promise((resolve, reject) => {
    Post.findAll({
      where: { id },
    })
      .then((data) => resolve(data[0]))
      .catch((err) => reject(NO_RESULTS));
  });
}

// create and saves the postData to a PostgreSQL database
function addPost(postData, userId) {
  return new Promise((resolve, reject) => {
    // Ensure value is correct when user toggled or not the
    // published property in the form
    postData.published = postData.published ? true : false;
    for (let key in postData) {
      // make any blank values be null when user did not input a value on a field
      if (postData[key] === "") {
        postData[key] = null;
      }
    }

    // assign postDate val as current date when posted
    postData.postDate = new Date();
    // assign userOrigin as the userID
    postData.userOrigin = userId;

    Post.create(postData)
      .then((data) => resolve(data))
      .catch((err) => reject("unable to create post"));
  });
}

async function updatePost(postId, postData) {
  try {
    postData.isUpdated = true;
    postData.published = postData.published ? true : false;
    await Post.update(postData, { where: { id: postId } });
  } catch (err) {
    throw err;
  }
}

// create and saves the categoryData to a PostgreSQL database
function addCategory(categoryData, userId) {
  return new Promise((resolve, reject) => {
    // adds the id of the creator of the category
    categoryData.userOrigin = userId.toString();

    Category.create(categoryData)
      .then((data) => resolve(data))
      .catch((err) => reject("unable to create category"));
  });
}

// deletes specific category by its id
function deleteCategoryById(id, userId) {
  return new Promise((resolve, reject) => {
    Category.destroy({
      where: { id, userOrigin: userId },
    })
      .then(() => resolve("destroyed"))
      .catch((err) => reject("Unable to Remove Category / Category not found"));
  });
}

// deletes specific Post by its id
function deletePostById(id, userId) {
  return new Promise((resolve, reject) => {
    Post.destroy({
      where: { id, userOrigin: userId },
    })
      .then(() => resolve("destroyed"))
      .catch((err) => reject("Unable to Remove Post / Post not found"));
  });
}

async function getPostOrigin(postId) {
  try {
    const origin = await Post.findByPk(postId, {
      attributes: ["userOrigin"],
    });
    return origin ? origin.userOrigin : null;
  } catch (err) {}
}

async function getPaginationPageCount(postPerPage, category) {
  try {
    const total = category
      ? await Post.count({ where: { category: category } })
      : await Post.count();

    const pageNumbers = [];

    const math = Math.ceil(total / postPerPage);
    for (let i = 1; i <= math; i++) {
      pageNumbers.push(i);
    }
    return pageNumbers;
  } catch (err) {
    throw new Error("Error on calculating pagination page count");
  }
}

async function getPaginatedPostByCategory(category, postPerPage, currentPage) {
  const offset = (currentPage - 1) * postPerPage;
  try {
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

async function getPaginatedPost(postPerPage, currentPage) {
  const offset = (currentPage - 1) * postPerPage;
  try {
    const posts = await Post.findAll({
      limit: postPerPage,
      offset: offset,
      where: {
        published: true,
      },
      order: [["updatedAt", "DESC"]],
    });

    return posts;
  } catch (err) {
    throw new Error("Error fetching paginated posts");
  }
}

async function getCategoryCount() {
  try {
    const categoryCount = await Category.count();
    return categoryCount;
  } catch (err) {
    throw new Error("Error fetching number of categories");
  }
}

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
