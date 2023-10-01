const authData = require("./services/auth-service.js");
const blogService = require("./services/blog-service.js");
const app = require("./app");

const HTTP_PORT = process.env.PORT || 8080;

// Initialize services and start the Express server.
(async () => {
  try {
    // Initialize the blogService to set up database connections and models.
    await blogService.initialize();
    // Initialize authData service, which sets up authentication related configurations.
    await authData.initialize();
    app.listen(
      HTTP_PORT,
      console.log("Express http server listening on", HTTP_PORT)
    );
  } catch (err) {
    console.error("Error occurred:", err);
  }
})();
