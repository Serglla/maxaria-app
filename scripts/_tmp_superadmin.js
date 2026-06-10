const db = require("better-sqlite3")(require("path").join(__dirname, "..", "data", "maxaria.db"));
db.prepare("UPDATE users SET is_superadmin = 1 WHERE username = 'claudetest'").run();
console.log(db.prepare("SELECT id, username, level, is_superadmin FROM users WHERE username = 'claudetest'").get());
