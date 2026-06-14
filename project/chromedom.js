const { execSync } = require("child_process");
const fs = require("fs");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Use --dump-dom to get rendered HTML
try {
  const result = execSync(`"${chromePath}" --headless --dump-dom --virtual-time-budget=10000 http://localhost:5173/login 2>&1`, { timeout: 20000 });
  console.log(result.toString().substring(0, 2000));
} catch(e) {
  console.log("Error:", e.message);
}
