require("dotenv").config();
const NO_RESULTS = "no results returned"; // reject message
const Sequelize = require("sequelize");

// set up sequelize to point to a postgres database
const sequelize = new Sequelize(process.env.ELEPHANTSQL_CONNECTION_STRING, {
  dialectOptions: {
    ssl: { rejectUnauthorized: false },
  },
  query: { raw: true },
  logging: false,
});

// Data Model
const Post = sequelize.define("Post", {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  postDate: Sequelize.DATE,
  lastUpdate: Sequelize.DATE,
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
  userOrigin: Sequelize.STRING,
});

// Data Model
const Category = sequelize.define("Category", {
  category: Sequelize.STRING,
  userOrigin: Sequelize.STRING,
});

// Post model gets a "category" column that will act as
// a foreign key to the Category model
Post.belongsTo(Category, { foreignKey: "category" });

// ensure that we can connect to the DB and that our Post and
// Category models are represented in the database as tables
function initialize() {
  return new Promise((resolve, reject) => {
    sequelize
      .sync()
      .then(() => resolve())
      .catch((err) => reject("unable to sync the database"));
  });
}

// retrieves all posts from the PostgreSQL database
function getAllPosts(userId) {
  return new Promise((resolve, reject) => {
    Post.findAll()
      .then((posts) => {
        posts.forEach((post) => (post.userOrigin = post.userOrigin === userId));
        resolve(posts);
      })
      .catch((err) => reject(NO_RESULTS));
  });
}

// gets all post who's published val is set to true
function getPublishedPosts() {
  return new Promise((resolve, reject) => {
    Post.findAll({
      where: { published: true },
    })
      .then((data) => resolve(data))
      .catch((err) => reject("unable to create post"));
  });
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

// filter the results by "published" & "category"
// (using the value true for "published" & the value passed to the function
function getPublishedPostsByCategory(category) {
  return new Promise((resolve, reject) => {
    Post.findAll({
      where: {
        published: true,
        category: category,
      },
    })
      .then((data) => resolve(data))
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
    postData.lastUpdate = new Date();
    postData.published = postData.published ? true : false;
    await Post.update(postData, { where: { id: postId } });
    // return { success: true, message: "Post updated successfully" };
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

module.exports = {
  initialize,
  getAllPosts,
  getPublishedPosts,
  getCategories,
  getPostsByCategory,
  getPostsByMinDate,
  getPostById,
  getPublishedPostsByCategory,
  addPost,
  addCategory,
  deleteCategoryById,
  deletePostById,
  getPostOrigin,
  updatePost,

  getPaginationPageCount,
  getPaginatedPostByCategory,
  getPaginatedPost,
};
