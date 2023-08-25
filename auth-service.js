require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const userSchema = new Schema({
  userName: {
    type: String,
    unique: true,
  },
  password: String,
  email: String,
  loginHistory: [
    {
      dateTime: Date,
      userAgent: String,
    },
  ],
});
let User;

function initialize() {
  return new Promise(function (resolve, reject) {
    const db = mongoose.createConnection(process.env.MONGO_CONNECTION_STRING);

    // reject the promise with the provided error
    db.on("error", (err) => reject(err));
    db.once("open", () => {
      User = db.model("users", userSchema);
      resolve();
    });
  });
}

function registerUser(userData) {
  return new Promise((resolve, reject) => {
    if (userData.password !== userData.password2) {
      reject("Passwords do not match");
    } else {
      bcrypt
        .hash(userData.password, 10)
        .then((hash) => {
          userData.password = hash;
          let newUser = new User(userData);
          newUser
            .save()
            .then(() => resolve())
            .catch((err) => {
              err.code === "11000"
                ? reject("User Name already taken")
                : reject(`There was an error creating the user: ${err}`);
            });
        })
        .catch((err) => reject("There was an error encrypting the password"));
    }
  });
}

function checkUser(userData) {
  return new Promise((resolve, reject) => {
    User.find({ userName: userData.userName })
      .exec()
      .then((users) => {
        // reject if no user is found with the given userName
        if (!users.length) {
          reject(`Unable to find user: ${userData.userName}`);
        } else {
          bcrypt
            .compare(userData.password, users[0].password)
            .then((result) => {
              if (result) {
                // add the login history to the user object.
                users[0].loginHistory.push({
                  dateTime: new Date().toString(),
                  userAgent: userData.userAgent,
                });

                // update the user login history in the database.
                User.updateOne(
                  { userName: users[0].userName },
                  { $set: { loginHistory: users[0].loginHistory } }
                )
                  .exec()
                  .then(() => resolve(users[0]))
                  .catch((err) =>
                    reject(`There was an error verifying the user: ${err}`)
                  );
              } else {
                // when above condition fails (password mismatch), reject the promise
                reject(`Incorrect Password for user: ${userData.userName}`);
              }
            });
        }
      })
      .catch((err) => reject(`Unable to find user: ${userData.userName}`));
  });
}
async function getUserCount() {
  try {
    const userCount = await User.countDocuments({});
    return userCount;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  initialize,
  registerUser,
  checkUser,
  getUserCount,
};
