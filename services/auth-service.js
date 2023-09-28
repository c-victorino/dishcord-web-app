require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const userSchema = new Schema({
  userName: {
    type: String,
    unique: true,
    required: true,
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

/**
 * Initializes a connection to a MongoDB database and sets up a user model
 * @returns {Promise<void>} resolves when database connection is successfully established
 * @throws {Error} If there is an error during database connection setup
 */
async function initialize() {
  try {
    const db = await mongoose.createConnection(
      process.env.MONGO_CONNECTION_STRING
    );

    db.on("error", (err) => {
      console.error("Database connection error:", err);
    });

    db.once("open", () => {
      User = db.model("users", userSchema);
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Registers a new user
 * @param {Object} userData - User data contains username, password, password2, and email
 * @returns {Promise<string>} A promise that resolves to a success message if registration is successful
 * @throws {Error} If passwords do not match, username is taken, or other error during registration
 */
async function registerUser(userData) {
  // Check if passwords match
  if (userData.password !== userData.password2) {
    throw new Error("Passwords do not match");
  }

  try {
    // Hash user input password
    userData.password = await bcrypt.hash(userData.password, 10);
    // Create & save new user to database(MongoDB)
    const newUser = new User(userData);
    await newUser.save();

    return "User registered successfully";
  } catch (err) {
    if (err.code === 11000) {
      throw new Error("User Name already taken");
    } else {
      throw new Error(`There was an error creating the user: ${err.message}`);
    }
  }
}

/**
 * Verifies user and their password (used for Login ).
 * @param {Object} userData - User data contains userName and password
 * @returns {Promise<Object>} A promise when authentication is successful.
 * @throws {Error} If no user is found, password is incorrect, or error during process.
 */
async function checkUser(userData) {
  try {
    // check if user in the database
    const user = await User.findOne({ userName: userData.userName });
    if (!user) {
      throw new Error(`Unable to find user: ${userData.userName}`);
    }

    const result = await bcrypt.compare(userData.password, user.password);
    if (!result) {
      throw new Error(`Incorrect Password for user: ${userData.userName}`);
    }

    user.loginHistory.push({
      dateTime: new Date().toString(),
      userAgent: userData.userAgent,
    });

    await User.updateOne(
      { userName: user.userName },
      { $set: { loginHistory: user.loginHistory } }
    );

    return user;
  } catch (err) {
    console.log("crash Here");
    throw err;
  }
}

// Retrieves the total count of users
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
