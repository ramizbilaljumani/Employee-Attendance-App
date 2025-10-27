const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database
const db = new sqlite3.Database("./attendance.db", (err) => {
  if (err) console.error(err.message);
  console.log("Connected to SQLite database.");
});

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT,
    check_in TEXT,
    check_out TEXT,
    break_start TEXT,
    break_end TEXT
  )
`);

// Check-in
app.post("/checkin", (req, res) => {
  const { name } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString();

  db.run(
    `INSERT INTO attendance (name, date, check_in) VALUES (?, ?, ?)`,
    [name, date, time],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.send({ message: `${name} checked in at ${time}` });
    }
  );
});

// Check-out
app.post("/checkout", (req, res) => {
  const { name } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString();

  db.run(
    `UPDATE attendance SET check_out = ? WHERE name = ? AND date = ?`,
    [time, name, date],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.send({ message: `${name} checked out at ${time}` });
    }
  );
});

// Test route
app.get("/", (req, res) => {
  res.send("Attendance API is running...");
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// Break Start
app.post("/breakstart", (req, res) => {
  const { name } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString();

  db.run(
    `UPDATE attendance SET break_start = ? WHERE name = ? AND date = ?`,
    [time, name, date],
    function(err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) {
        db.run(
          `INSERT INTO attendance (name, date, break_start) VALUES (?, ?, ?)`,
          [name, date, time]
        );
      }
      res.send({ message: `${name} break started at ${time}` });
    }
  );
});

// Break End
app.post("/breakend", (req, res) => {
  const { name } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString();

  db.run(
    `UPDATE attendance SET break_end = ? WHERE name = ? AND date = ?`,
    [time, name, date],
    function(err) {
      if (err) return res.status(500).send(err.message);
      res.send({ message: `${name} break ended at ${time}` });
    }
  );
});
