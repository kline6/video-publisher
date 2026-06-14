const { execSync } = require("child_process");
const fs = require("fs");

// Use Chrome in headless mode to screenshot
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = "E:\\gongzhonghaoxiangmu\\project";

try {
  execSync(`"${chromePath}" --headless --disable-gpu --screenshot="${tempDir}\\screenshot.png" --window-size=1280,800 http://localhost:5173/login`, { timeout: 15000 });
  console.log("Screenshot saved");
} catch(e) {
  console.log("Chrome headless error:", e.message);
}
