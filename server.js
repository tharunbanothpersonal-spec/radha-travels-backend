// server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // ✅ allow frontend on Netlify to call this API
app.use(express.json());   // ✅ JSON body parsing enabled globally

const PUBLIC_DIR = path.join(__dirname, "public");
const GALLERY_DIR = path.join(PUBLIC_DIR, "images", "gallery");
const CAPTIONS_FILE = path.join(GALLERY_DIR, "captions.json");
const REVIEWS_FILE = path.join(__dirname, "reviews.json");

// Static files (optional: only if you want to serve images too)
app.use("/images", express.static(path.join(PUBLIC_DIR, "images")));

function loadCaptions() {
  try {
    const txt = fs.readFileSync(CAPTIONS_FILE, "utf8");
    return JSON.parse(txt);
  } catch {
    return {}; // no captions.json yet → fine
  }
}

function prettyFromFilename(filename) {
  const name = path.parse(filename).name;
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// API → returns [{src, caption}]
app.get("/api/gallery", (req, res) => {
  fs.readdir(GALLERY_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: "Gallery folder not found" });

    const captions = loadCaptions();
    const images = (files || []).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));

    const payload = images.map((file) => ({
      src: `${req.protocol}://${req.get("host")}/images/gallery/${encodeURIComponent(file)}`,
      caption: captions[file] || prettyFromFilename(file),
    }));

    res.json(payload);
  });
});

// Health check (optional for Render)
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// === Reviews API ===


// Load reviews from file
// === Reviews API ===
function loadReviews() {
  try {
    return JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

// GET all reviews
app.get("/api/reviews", (req, res) => {
  res.json(loadReviews());
});

// POST new review
app.post("/api/reviews", (req, res) => {
  const { name, rating, text } = req.body;
  if (!rating || !text) {
    return res.status(400).json({ error: "Rating and feedback required" });
  }
  const reviews = loadReviews();
  const review = {
    name: name || "Anonymous",
    rating: Number(rating),
    text,
    date: new Date().toISOString(),
  };
  reviews.unshift(review);
  saveReviews(reviews);
  res.json({ success: true, review });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));