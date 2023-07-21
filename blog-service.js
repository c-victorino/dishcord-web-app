const NO_RESULTS = "no results returned"; // reject message
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  "diofiijo",
  "diofiijo",
  "YkA73dsNL227-uMZ3wJM91RNRCsmz3B7",
  {
    host: "stampy.db.elephantsql.com",
    dialect: "postgres",
    port: 5432,
    dialectOptions: {
      ssl: { rejectUnauthorized: false },
    },
    query: { raw: true },
  }
);

// Data Model
const Post = sequelize.define("Post", {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  postDate: Sequelize.DATE,
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
});

// Data Model
const Category = sequelize.define("Category", {
  category: Sequelize.STRING,
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
function getAllPosts() {
  return new Promise((resolve, reject) => {
    Post.findAll()
      .then((posts) => resolve(posts))
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
function getCategories() {
  return new Promise((resolve, reject) => {
    Category.findAll()
      .then((data) => resolve(data))
      .catch((err) => reject(NO_RESULTS));
  });
}

// get post who's category value is the value passed to the function
function getPostsByCategory(category) {
  return new Promise((resolve, reject) => {
    Post.findAll({
      where: {
        category,
      },
    })
      .then((posts) => resolve(posts))
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
      .then((data) => resolve(data))
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
function addPost(postData) {
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

    Post.create(postData)
      .then((data) => resolve(data))
      .catch((err) => reject("unable to create post"));
  });
}

// create and saves the categoryData to a PostgreSQL database
function addCategory(categoryData) {
  return new Promise((resolve, reject) => {
    for (let key in categoryData) {
      // ensure that any blank values in categoryData are set to null
      if (categoryData[key] === "") {
        categoryData[key] = null;
      }
    }

    Category.create(categoryData)
      .then((data) => resolve(data))
      .catch((err) => reject("unable to create category"));
  });
}

// deletes specific category by its id
function deleteCategoryById(id) {
  return new Promise((resolve, reject) => {
    Category.destroy({
      where: { id },
    })
      .then(() => resolve("destroyed"))
      .catch((err) => reject("Unable to Remove Category / Category not found"));
  });
}

// deletes specific Post by its id
function deletePostById(id) {
  return new Promise((resolve, reject) => {
    Post.destroy({
      where: { id },
    })
      .then(() => resolve("destroyed"))
      .catch((err) => reject("Unable to Remove Post / Post not found"));
  });
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
};
