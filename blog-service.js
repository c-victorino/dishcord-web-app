// const { rejects } = require("assert");
// const { resolve } = require("path");
const fs = require("fs");
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

module.exports = {
  initialize,
  getAllPosts,
  getPublishedPosts,
  getCategories,
};
