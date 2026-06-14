const { Pool } = require("pg");
const pool = new Pool({ host: "localhost", port: 5432, user: "videouser", password: "videopass", database: "videoflow" });
(async () => {
  const r1 = await pool.query("DELETE FROM video_stats WHERE platform_video_id LIKE 'demo_%' OR platform_video_id LIKE 'mock_%'");
  console.log("Deleted video_stats:", r1.rowCount);
  const r2 = await pool.query("DELETE FROM publish_tasks WHERE status = 'failed'");
  console.log("Deleted failed tasks:", r2.rowCount);
  const r3 = await pool.query("SELECT COUNT(*) FROM video_stats");
  console.log("Remaining video_stats:", r3.rows[0].count);
  const r4 = await pool.query("SELECT COUNT(*) FROM publish_tasks");
  console.log("Remaining tasks:", r4.rows[0].count);
  await pool.end();
})();
