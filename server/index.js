import express from "express";
import cors from "cors";
import pool from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Register endpoint (for creating users)
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    await pool.query(
      'INSERT INTO "admin-mgmt" (username, password) VALUES ($1, $2)',
      [username, password]
    );
    res.status(201).json({ message: "User registered!" });
  } catch (err) {
    res.status(400).json({ error: "Username may already exist." });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await pool.query(
      'SELECT * FROM "admin-mgmt" WHERE username = $1 AND password = $2',
      [username, password]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Return rights in response
    const rights = userRes.rows[0].rights;
    res.json({ message: "Login successful", username, rights });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// RBAC middleware
async function checkRights(req, res, next, allowed) {
  const username = req.headers["x-username"];
  if (!username) return res.status(401).json({ error: "Unauthorized" });
  const userRes = await pool.query(
    'SELECT rights FROM "admin-mgmt" WHERE username = $1',
    [username]
  );
  if (!userRes.rows.length) return res.status(403).json({ error: "Forbidden" });
  const rights = userRes.rows[0].rights;
  if (!allowed.includes(rights)) {
    return res.status(403).json({ error: "Forbidden: Insufficient rights" });
  }
  req.userRights = rights;
  next();
}

// Inventory endpoint
app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT sku, name, image_url, description, quantity, price, discount_name, discount_percentage, discount_amount, discount_dates FROM inventory"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// Protect add (POST) - admin, staff
app.post(
  "/inventory",
  async (req, res, next) => {
    await checkRights(req, res, () => next(), ["admin", "staff"]);
  },
  async (req, res) => {
    const {
      sku,
      name,
      image_url,
      description,
      quantity,
      price,
      discount_name,
      discount_percentage,
      discount_amount,
      discount_dates,
    } = req.body;
    try {
      await pool.query(
        `INSERT INTO inventory
        (sku, name, image_url, description, quantity, price, discount_name, discount_percentage, discount_amount, discount_dates)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          sku,
          name,
          image_url,
          description,
          quantity,
          price,
          discount_name,
          discount_percentage,
          discount_amount,
          discount_dates,
        ]
      );
      res.status(201).json({ message: "Inventory item added!" });
    } catch (err) {
      res.status(400).json({ error: "Failed to add inventory item." });
    }
  }
);

// Protect edit (PUT) - admin only
app.put(
  "/inventory/:sku",
  async (req, res, next) => {
    await checkRights(req, res, () => next(), ["admin"]);
  },
  async (req, res) => {
    const {
      name,
      image_url,
      description,
      quantity,
      price,
      discount_name,
      discount_percentage,
      discount_amount,
      discount_dates,
    } = req.body;
    const { sku } = req.params;
    try {
      const result = await pool.query(
        `UPDATE inventory SET
        name = $1,
        image_url = $2,
        description = $3,
        quantity = $4,
        price = $5,
        discount_name = $6,
        discount_percentage = $7,
        discount_amount = $8,
        discount_dates = $9
      WHERE sku = $10
      RETURNING *`,
        [
          name,
          image_url,
          description,
          quantity,
          price,
          discount_name,
          discount_percentage,
          discount_amount,
          discount_dates,
          sku,
        ]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ message: "Inventory item updated!", item: result.rows[0] });
    } catch (err) {
      res.status(400).json({ error: "Failed to update inventory item." });
    }
  }
);

// Protect delete (DELETE) - admin only
app.delete(
  "/inventory/:sku",
  async (req, res, next) => {
    await checkRights(req, res, () => next(), ["admin"]);
  },
  async (req, res) => {
    const { sku } = req.params;
    try {
      const result = await pool.query("DELETE FROM inventory WHERE sku = $1", [
        sku,
      ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ message: "Inventory item deleted!" });
    } catch (err) {
      res.status(400).json({ error: "Failed to delete inventory item." });
    }
  }
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
