const express = require("express");
const router = express.Router();
const authData = require("../services/auth-service.js");

// Render the "login" page
router.get("/login", (req, res) => res.render("login"));

// POST route to handle user login
router.post("/login", async (req, res) => {
  try {
    // Authenticate the user using provided credentials
    console.log(req.body);
    const user = await authData.checkUser(req.body);

    // If authentication is successful, create a session

    req.session.user = {
      id: user._id.toString(),
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory,
    };
    console.log("crash Here1");
    res.redirect("/posts");
  } catch (err) {
    res.render("login", { errorMessage: err, userName: req.body.userName });
  }
});

// Route for logging out a user
router.get("/logout", (req, res) => {
  // Remove session data associated with the user's session
  req.session.destroy();
  // Redirect the user to the home page after logging out
  res.redirect("/");
});

// Render "register" template when GET request is made to "/register"
router.get("/register", (req, res) => res.render("register"));

// Handle registration form submission via POST request
router.post("/register", async (req, res) => {
  try {
    // Attempt to register user with data from request body
    const result = await authData.registerUser(req.body);
    // If successful, render the register view with success message
    res.render("register", { successMessage: result });
  } catch (err) {
    res.render("register", { errorMessage: err, userName: req.body.userName });
  }
});

module.exports = router;
