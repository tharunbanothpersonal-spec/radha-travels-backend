// routes/reviews.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const REVIEWS_FILE = path.join(__dirname, '../data/reviews.json');

// Ensure reviews file exists
if (!fs.existsSync(REVIEWS_FILE)) {
  fs.mkdirSync(path.dirname(REVIEWS_FILE), { recursive: true });
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify([]));
}

function readReviews() {
  const raw = fs.readFileSync(REVIEWS_FILE, 'utf8') || '[]';
  try { return JSON.parse(raw); } catch (e) { return []; }
}
function writeReviews(arr) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

// GET /api/reviews
router.get('/', (req, res) => {
  const reviews = readReviews();
  res.json(reviews);
});

// POST /api/reviews
router.post('/', (req, res) => {
  const { name, rating, comment } = req.body || {};

  // ✅ Require all 3 fields
  if (!name || !rating || !comment) {
    return res.status(400).json({ error: 'name, rating, and comment are required' });
  }

  const reviews = readReviews();
  const newReview = {
    id: Date.now(),
    name: String(name).trim().slice(0, 100),   // trim + limit length
    rating: Number(rating),
    comment: String(comment).trim().slice(0, 1000),
    createdAt: new Date().toISOString()
  };

  reviews.unshift(newReview); // newest first
  writeReviews(reviews);
  res.status(201).json(newReview);
});

module.exports = router;
