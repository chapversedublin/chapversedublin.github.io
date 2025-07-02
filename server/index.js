import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import pool from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Register endpoint (for creating users)
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO "admin-mgmt" (username, password) VALUES ($1, $2)',
      [username, hash]
    );
    res.status(201).json({ message: "User registered!" });
  } catch (err) {
    res.status(400).json({ error: "Username may already exist." });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query(
    'SELECT * FROM "admin-mgmt" WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ message: "Login successful!" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
