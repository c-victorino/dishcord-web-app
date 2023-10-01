const stripJs = require("strip-js");

module.exports = {
  // automatically generates correct <li> element and adds class "active" if provided URL matches active route.
  // {{#navLink "/about"}}About{{/navLink}}
  navLink: function (url, options) {
    const isActive = url === this.activeRoute; // Use 'this' to access activeRoute
    const navClass = isActive ? "active" : "";

    return `
      <li class="nav-item">
        <a href="${url}" class="nav-link ${navClass}">
          ${options.fn(this)}
        </a>
      </li>
    `;
  },

  // removes unwanted JavaScript code from post body string by using a custom package: strip-js
  // {{#safeHTML someString}}{{/safeHTML}}
  safeHTML: (context) => {
    return stripJs(context);
  },

  // Keep date formatting consistent in views.
  // {{#formatDate postDate}}{{/formatDate}}
  formatDate: (dateObj) => dateObj.toISOString().slice(0, 10),

  ifEquals: function (arg1, arg2, options) {
    if (arg1 === arg2) {
      // Render content inside the {{#ifEquals}} block
      return options.fn(this);
    }
  },
};
