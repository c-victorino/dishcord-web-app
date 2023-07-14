// const { rejects } = require("assert");
// const { resolve } = require("path");
const { rejects } = require("assert");
const fs = require("fs");
const { resolve } = require("path");
let posts = [];
let categories = [];

const readJson = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
};

function currentDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function initialize() {
  return new Promise((resolve, reject) => {
    readJson("./data/posts.json")
      .then((fileData) => {
        posts = fileData;
        return readJson("./data/categories.json");
      })
      .then((fileData) => {
        categories = fileData;
        resolve();
      })
      .catch((err) => {
        reject("unable to read file");
      });
  });
}

function getAllPosts() {
  return new Promise((resolve, reject) => {
    !posts.length ? reject("no results returned") : resolve(posts);
  });
}

function getPublishedPosts() {
  return new Promise((resolve, reject) => {
    const result = posts.filter((post) => post.published);
    !result.length ? reject("no results returned") : resolve(result);
  });
}

function getCategories() {
  return new Promise((resolve, reject) => {
    !posts.length ? reject("no results returned") : resolve(categories);
  });
}

function getPostsByCategory(category) {
  return new Promise((resolve, reject) => {
    const result = posts.filter((post) => category == post.category);
    !result.length ? reject("no results returned") : resolve(result);
  });
}

function getPostsByMinDate(minDateStr) {
  return new Promise((resolve, reject) => {
    const dateStr = new Date(minDateStr);
    const result = posts.filter((post) => new Date(post.postDate) >= dateStr);
    !result.length ? reject("no results returned") : resolve(result);
  });
}

function getPostById(id) {
  return new Promise((resolve, reject) => {
    const result = posts.filter((post) => post.id == id)[0];
    !result ? reject("no results returned") : resolve(result);
  });
}

function getPublishedPostsByCategory(category) {
  return new Promise((resolve, reject) => {
    const result = posts.filter(
      (post) => post.published && post.category == category
    );
    !result.length ? reject("no results returned") : resolve(result);
  });
}

function addPost(postData) {
  return new Promise((resolve, reject) => {
    if (Object.keys(postData).length === 0) {
      reject("post data not found");
    }
    postData.published = postData.published !== undefined;
    postData.id = posts.length + 1;
    postData.postDate = currentDate();
    posts.push(postData);
    resolve(postData);
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
};
