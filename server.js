// server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // ✅ allow frontend on Netlify to call this API

const PUBLIC_DIR = path.join(__dirname, "public");
const GALLERY_DIR = path.join(PUBLIC_DIR, "images", "gallery");
const CAPTIONS_FILE = path.join(GALLERY_DIR, "captions.json");

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
