// Intersection reveal helper (data-reveal attribute)
(function wireReveal(){
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
})();

// Lazy load gallery images (use loading="lazy" and fallback)
function lazyLoadGalleryImgs() {
  document.querySelectorAll('#galleryGrid img').forEach(img => {
    if (!('loading' in HTMLImageElement.prototype)) {
      // polyfill or intersection observer
      const io = new IntersectionObserver((entries, o) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            o.unobserve(img);
          }
        });
      });
      io.observe(img);
    } else {
      // native: do nothing (we set loading="lazy" when building HTML)
    }
  });
}

// === Configurable Pricing (INR) ===
const PRICING = {
  local: {
    baseKm: 80,
    baseHr: 8,
    hatchback: { base: 1000, extraKm: 12, extraHr: 120 },
    sedan:     { base: 1800, extraKm: 14, extraHr: 140 },
    suv:       { base: 2400, extraKm: 18, extraHr: 180 },
    premium_suv:{ base: 3000, extraKm: 22, extraHr: 250 }
  },
  airport: {
    hatchback:   { pickup: 1200, drop: 1100 },
    sedan:       { pickup: 1500, drop: 1200 },
    suv:         { pickup: 2000, drop: 1800 },
    premium_suv: { pickup: 2400, drop: 2200 }
  },
  outstation: {
    hatchback:   { perKm: 12, minKmPerDay: 300 },
    sedan:       { perKm: 14, minKmPerDay: 300 },
    suv:         { perKm: 18, minKmPerDay: 300 },
    premium_suv: { perKm: 22, minKmPerDay: 300 }
  }
};

// === Helpers ===
const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const byId = (id) => document.getElementById(id);

// === Year in footer ===
const yearEl = byId('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// === Mobile menu ===
const toggle = document.querySelector('.nav__toggle');
const links  = document.querySelector('.nav__links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// === Quick Estimate ===
const estimateForm   = byId('quick-estimate');
const estimateResult = byId('estimateResult');
const estimateHint   = byId('estimateHint');
const serviceSelect  = byId('serviceType');
const daysRow        = byId('daysRow');
const hoursRow       = byId('hoursRow');
const distanceLabel  = byId('distanceLabel');

function updateEstimatorUI() {
  const st = serviceSelect.value;
  if (st === 'outstation') {
    daysRow.style.display = 'grid';
    hoursRow.style.display = 'none';
    distanceLabel.textContent = 'Estimated Total Distance (km)';
  } else if (st === 'local') {
    daysRow.style.display = 'none';
    hoursRow.style.display = 'grid';
    distanceLabel.textContent = 'Estimated Distance (km)';
  } else {
    daysRow.style.display = 'none';
    hoursRow.style.display = 'none';
    distanceLabel.textContent = 'Estimated Distance (km)';
  }
}
if (serviceSelect) {
  serviceSelect.addEventListener('change', updateEstimatorUI);
  updateEstimatorUI();
}

function estimateFare({ serviceType, segment, distance, hours = PRICING.local.baseHr, days = 1 }) {
  distance = Number(distance || 0);
  hours    = Number(hours || 0);
  days     = Number(days || 1);

  if (serviceType === 'local') {
    const p = PRICING.local[segment];
    const extraKm = Math.max(0, distance - PRICING.local.baseKm);
    const extraHr = Math.max(0, hours - PRICING.local.baseHr);
    return {
      total: p.base + (extraKm * p.extraKm) + (extraHr * p.extraHr),
      breakdown: `Base ${formatINR(p.base)} + ${extraKm} km × ${formatINR(p.extraKm)} + ${extraHr} hr × ${formatINR(p.extraHr)}`
    };
  }

  if (serviceType === 'airport') {
    const p = PRICING.airport[segment];
    const avg = Math.round((p.pickup + p.drop) / 2);
    return {
      total: avg,
      breakdown: `Pickup ${formatINR(p.pickup)} | Drop ${formatINR(p.drop)}`
    };
  }

  if (serviceType === 'outstation') {
    const p = PRICING.outstation[segment];
    const minForTrip = p.minKmPerDay * days;
    const chargeableKm = Math.max(distance, minForTrip);
    const total = p.perKm * chargeableKm;
    return {
      total,
      breakdown: `Chargeable: ${chargeableKm} km × ${formatINR(p.perKm)}/km (min ${p.minKmPerDay} km/day × ${days} days)`
    };
  }

  return { total: 0, breakdown: '' };
}

if (estimateForm) {
  estimateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(estimateForm));
    const { total, breakdown } = estimateFare({
      serviceType: data.serviceType,
      segment: data.segment,
      distance: Number(data.distance || 0),
      hours: Number(data.hours || PRICING.local.baseHr),
      days: Number(data.days || 1)
    });
    estimateResult.textContent = `Estimated fare: ${formatINR(total)} (approx)`;
    estimateHint.textContent = breakdown;
  });
}

// === Fleet Modal Logic ===
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("fleetModal");
  const closeBtn = modal.querySelector(".close");
  const carTitle = document.getElementById("carTitle");
  const carPricing = document.getElementById("carPricing");
  const bookNow = document.getElementById("bookNow");

  function buildFleetTable(segmentKey) {
    const local = PRICING.local[segmentKey];
    const airport = PRICING.airport[segmentKey];
    const outstation = PRICING.outstation[segmentKey];

    return `
      <table>
        <tr><th>Service</th><th>Rate</th></tr>
        <tr><td>Local (8Hr / ${PRICING.local.baseKm}Km)</td>
            <td>${formatINR(local.base)} + ${formatINR(local.extraKm)}/km + ${formatINR(local.extraHr)}/hr</td></tr>
        <tr><td>Outstation</td>
            <td>${formatINR(outstation.perKm)}/km (Min. ${outstation.minKmPerDay} km/day)</td></tr>
        <tr><td>Airport</td>
            <td>Pickup ${formatINR(airport.pickup)} / Drop ${formatINR(airport.drop)}</td></tr>
      </table>`;
  }

  document.querySelectorAll(".view-details").forEach(btn => {
    btn.addEventListener("click", () => {
      const carKey = btn.dataset.car;
      const segKey = carKey.includes("etios") || carKey.includes("ciaz") ? "sedan"
                  : carKey.includes("swift") ? "hatchback"
                  : carKey.includes("ertiga") ? "suv"
                  : "premium_suv";

      carTitle.textContent = btn.parentElement.querySelector("h3").textContent;
      carPricing.innerHTML = buildFleetTable(segKey);
      bookNow.href = `https://wa.me/918332958915?text=Hi,%20I%20want%20to%20book%20${encodeURIComponent(carTitle.textContent)}`;
      modal.classList.add("show");
    });
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("show");
  });

  modal.addEventListener("click", (e) => {
    if (!e.target.closest(".modal-content")) {
      modal.classList.remove("show");
    }
  });
});

// === Auto Gallery with backend ===
async function loadGallery() {
  try {
    // Detect environment
const backendBase =
  window.location.hostname.includes("localhost")
    ? "http://localhost:5000"
    : "https://radha-travels-backend.onrender.com"; // 👈 replace with your Render URL

// Fetch from backend
const res = await fetch(`${backendBase}/api/gallery`);
    const galleryImages = await res.json();

    const galleryGrid = document.getElementById("galleryGrid");
    if (!galleryGrid) return;

    // build gallery items — use loading lazy and data-src for polyfill
galleryGrid.innerHTML = galleryImages.map(img =>
  `<figure class="gal-item" data-reveal>
     <img src="${img.src}" alt="${img.caption}" loading="lazy" data-src="${img.src}">
     <figcaption>${img.caption}</figcaption>
   </figure>` ).join('');
// then initialize lazy loader + reveal
lazyLoadGalleryImgs();
document.querySelectorAll('#galleryGrid figure').forEach(f => f.classList.add('is-visible')); // or rely on observer

    // Modal logic
    const galleryModal   = document.getElementById("galleryModal");
    const galleryImg     = document.getElementById("galleryImg");
    const galleryCaption = document.getElementById("galleryCaption");

    galleryGrid.querySelectorAll("figure").forEach((figure, i) => {
      figure.addEventListener("click", () => {
        galleryImg.src = galleryImages[i].src;
        galleryCaption.textContent = galleryImages[i].caption;
        galleryModal.classList.add("show");
      });
    });

    galleryModal.querySelector(".close").addEventListener("click", () => {
      galleryModal.classList.remove("show");
    });

    galleryModal.addEventListener("click", (e) => {
      if (!e.target.closest(".modal-inner")) galleryModal.classList.remove("show");
    });

  } catch (error) {
    console.error("Error loading gallery:", error);
  }
}
document.addEventListener("DOMContentLoaded", loadGallery);

// === Navbar scroll-spy ===
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = Array.from(document.querySelectorAll('.nav__links a[href^="#"]'));
  const sections = Array.from(document.querySelectorAll('section[id]'));
  if (!navLinks.length || !sections.length) return;

  const navLinksContainer = document.querySelector('.nav__links');
  const navToggle = document.querySelector('.nav__toggle');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (navLinksContainer && navLinksContainer.classList.contains('open')) {
        navLinksContainer.classList.remove('open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  const header = document.querySelector('.header');
  const headerHeight = header ? header.offsetHeight : 0;

  if ('IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: `-${headerHeight + 10}px 0px -40% 0px`,
      threshold: 0.1
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.getAttribute('id');
        const matchingLink = document.querySelector(`.nav__links a[href="#${id}"]`);
        if (entry.isIntersecting) {
          navLinks.forEach(l => l.classList.remove('active'));
          if (matchingLink) matchingLink.classList.add('active');
        }
      });
    }, observerOptions);

    sections.forEach(s => observer.observe(s));
  } else {
    function onScroll() {
      const scrollPos = window.scrollY + headerHeight + 20;
      let currentId = sections[0].id || null;
      for (const s of sections) {
        if (s.offsetTop <= scrollPos) currentId = s.id;
      }
      navLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === `#${currentId}`);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
});

// === Review System with Backend ===
let selectedRating = 0;
const backendBase =
  window.location.hostname.includes("localhost")
    ? "http://localhost:5000"
    : "https://radha-travels-backend.onrender.com";

    
// Elements
const starInput = document.getElementById("starInput");
const submitBtn = document.getElementById("submitReview");
const reviewsList = document.getElementById("reviewsList");
const avgRatingEl = document.getElementById("avgRating");
const avgStarsEl = document.getElementById("avgStars");
const reviewCountEl = document.getElementById("reviewCount");
const thankyouEl = document.getElementById("thankyouMessage");
const ratingBreakdownEl = document.getElementById("ratingBreakdown");

// --- Fetch & render reviews
async function loadReviews() {
  try {
    const res = await fetch(`${backendBase}/api/reviews`);
    const reviews = await res.json();
    renderReviews(reviews);
  } catch (err) {
    console.error("Failed to load reviews:", err);
  }
}
function renderReviews(reviews) {
  const reviewsList = document.getElementById("reviewsList");
  if (!reviewsList) return;

  reviewsList.innerHTML = "";
  reviews.forEach(r => addReviewCard(r, false));
  updateSummary(reviews);
}

// --- Star Selection
if (starInput) {
  const stars = starInput.querySelectorAll("span");
  stars.forEach((star, index) => {
    star.addEventListener("click", () => {
      selectedRating = index + 1;
      stars.forEach((s, i) => s.classList.toggle("active", i < selectedRating));
    });
  });
}

// --- Submit Review
submitBtn?.addEventListener("click", async () => {
  const name = document.getElementById("reviewerName").value || "Anonymous";
  const text = document.getElementById("reviewText").value.trim();

  if (!name.trim() || selectedRating < 1 || !text) {
  alert("Please enter your name, select at least 1 star, and write your feedback.");
  return;
}
  try {
    const res = await fetch(`${backendBase}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  name: document.getElementById("reviewerName").value.trim(),
  rating: selectedRating,
  comment: document.getElementById("reviewText").value.trim()
}),

    });
    const data = await res.json();

    if (!data.error) {
      // reload fresh reviews from backend
      loadReviews();

      // reset form
      document.getElementById("reviewerName").value = "";
      document.getElementById("reviewText").value = "";
      selectedRating = 0;
      starInput.querySelectorAll("span").forEach(s => s.classList.remove("active"));

      // thank you message
      thankyouEl.textContent = "✅ Thank you for your valuable rating!";
      thankyouEl.style.display = "block";
      setTimeout(() => { thankyouEl.style.display = "none"; }, 3000);

      reviewModal.classList.remove("show");
    }
  } catch (err) {
    console.error("Failed to submit review:", err);
  }
});


// --- Update Summary
function updateSummary(reviews) {
  if (!reviews.length) {
    avgRatingEl.textContent = "0.0";
    avgStarsEl.textContent = "";
    reviewCountEl.textContent = "0";
    ratingBreakdownEl.innerHTML = "";
    return;
  }
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  const avg = (total / reviews.length).toFixed(1);
  avgRatingEl.textContent = avg;
  avgStarsEl.textContent = "★".repeat(Math.round(avg));
  reviewCountEl.textContent = reviews.length;
  ratingBreakdownEl.innerHTML = "";
  for (let i = 5; i >= 1; i--) {
    const count = reviews.filter(r => r.rating === i).length;
    const percent = ((count / reviews.length) * 100).toFixed(0);
    ratingBreakdownEl.innerHTML += `
      <div class="bar">
        <span>${i}★</span>
        <div class="progress"><div style="width:${percent}%"></div></div>
        <span>${count}</span>
      </div>`;
  }
}

// --- Add Review Card
function addReviewCard({ name, rating, comment }, prepend = true) {
  const reviewsList = document.getElementById("reviewsList");
  if (!reviewsList) return;

  const card = document.createElement("div");
  card.className = "review-card";
  card.innerHTML = `
    <h4>${name}</h4>
    <div class="rating">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
    <p>${comment}</p>
  `;
  if (prepend) reviewsList.prepend(card);
  else reviewsList.append(card);
}

// Initial load
document.addEventListener("DOMContentLoaded", loadReviews);
// === Review Modal Controls ===
const openReviewFormBtn = document.getElementById("openReviewForm");
const reviewModal = document.getElementById("reviewModal");
const closeReviewModal = document.getElementById("closeReviewModal");
const openReviewsBtn = document.getElementById("openReviews");
const reviewsModal = document.getElementById("reviewsModal");
const closeReviewsModal = document.getElementById("closeReviewsModal");

// Open "Please rate us" form
openReviewFormBtn?.addEventListener("click", () => reviewModal.classList.add("show"));
// Close review form modal
closeReviewModal?.addEventListener("click", () => reviewModal.classList.remove("show"));

// Open reviews list
openReviewsBtn?.addEventListener("click", () => reviewsModal.classList.add("show"));
// Close reviews list
closeReviewsModal?.addEventListener("click", () => reviewsModal.classList.remove("show"));

// Close if clicked outside modal
window.addEventListener("click", (e) => {
  if (e.target === reviewModal) reviewModal.classList.remove("show");
  if (e.target === reviewsModal) reviewsModal.classList.remove("show");
});


// === Booking Form ===
// === Booking Form (dynamic by service) ===
// Config — set your EmailJS IDs here (or keep blank to skip)
const EMAILJS_CFG = {
  publicKey: "pD6nfIaDF2cJycoQR",
  serviceId: "service_1c2ksw9",
  templateId: "template_oa5vj3m",
};
// WhatsApp target
const WA_NUMBER = "918332958915";

// tiny helpers
const getEl = (id) => document.getElementById(id);
const msgEl = getEl("bookingMessage");
const phoneOk = (s) => /^[0-9]{10}$/.test(String(s).replace(/\D/g, ""));

// init EmailJS if present & keys provided
(function initEmailJS() {
  if (typeof emailjs !== "undefined" && EMAILJS_CFG.publicKey) {
    try { emailjs.init(EMAILJS_CFG.publicKey); } catch(e) { /* ignore */ }
  }
})();

// dynamic render
(function wireBookingForm() {
  const form = getEl("bookingForm");
  const serviceSel = getEl("bk_service");
  const dyn = getEl("bk_dynamic");

  if (!form || !serviceSel || !dyn) return;

  const carSelect = `
    <select id="bk_car" name="car" required>
      <option value="">Select Car</option>
      <option value="hatchback">Hatchback</option>
      <option value="sedan">Sedan</option>
      <option value="suv">SUV</option>
      <option value="premium_suv">Premium SUV</option>
    </select>`;

  function render(service) {
    dyn.innerHTML = ""; // reset
    if (!service) return;

    // shared chunks
    const pickup = `
      <div class="form__row">
        <label for="bk_pickup">Pickup Location</label>
        <input type="text" id="bk_pickup" name="pickup" placeholder="Area, landmark, city" required>
      </div>`;
    const when = `
      <div class="inline-2">
        <div class="form__row">
          <label for="bk_date">Date</label>
          <input type="date" id="bk_date" name="date" required>
        </div>
        <div class="form__row">
          <label for="bk_time">Time</label>
          <input type="time" id="bk_time" name="time" required>
        </div>
      </div>`;
    const notes = `
      <div class="form__row">
        <label for="bk_notes">Any Note</label>
        <textarea id="bk_notes" name="notes" placeholder="Anything we should know?"></textarea>
      </div>`;

    // service-specific
    if (service === "local") {
      dyn.innerHTML = `
        <div class="form-grid">
          <div class="form__row">
            <label for="bk_car">Car Segment</label>
            ${carSelect}
          </div>
          ${pickup}
          ${when}
          ${notes}
        </div>`;
    } else if (service === "outstation") {
      dyn.innerHTML = `
        <div class="form-grid">
          <div class="form__row">
            <label for="bk_car">Car Segment</label>
            ${carSelect}
          </div>
          ${pickup}
          ${when}
          <div class="form__row">
            <label for="bk_days">Number of Days</label>
            <input type="number" id="bk_days" name="days" min="1" value="1" required>
          </div>
          ${notes}
        </div>`;
    } else if (service === "airport") {
      dyn.innerHTML = `
        <div class="form-grid">
          <div class="form__row">
            <label for="bk_car">Car Segment</label>
            ${carSelect}
          </div>
          ${pickup}
          ${when}
          ${notes}
        </div>`;
    }
  }

  // initial + change
  render(serviceSel.value);
  serviceSel.addEventListener("change", (e) => render(e.target.value));

  // submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: getEl("bk_name")?.value?.trim(),
      phone: getEl("bk_phone")?.value?.trim(),
      email: getEl("bk_email")?.value?.trim() || "-",
      service: serviceSel.value,
      car: getEl("bk_car")?.value || "-",
      pickup: getEl("bk_pickup")?.value?.trim() || "-",
      date: getEl("bk_date")?.value || "-",
      time: getEl("bk_time")?.value || "-",
      days: getEl("bk_days")?.value || "-",
      notes: getEl("bk_notes")?.value?.trim() || "-",
    };

    // validations
    if (!data.name || !phoneOk(data.phone) || !data.service) {
      msgEl.style.color = "#fca5a5";
      msgEl.textContent = "Please enter name, a valid 10-digit phone, and select service.";
      return;
    }
    if (!data.pickup || !data.date || !data.time) {
      msgEl.style.color = "#fca5a5";
      msgEl.textContent = "Please fill pickup, date and time.";
      return;
    }
    if (data.service === "outstation" && (!data.days || Number(data.days) < 1)) {
      msgEl.style.color = "#fca5a5";
      msgEl.textContent = "Please enter a valid number of days for outstation.";
      return;
    }

    // Build unified message
    const lines = [
      "*New Booking – RADHA TRAVELS*",
      `Name: ${data.name}`,
      `Phone: ${data.phone}`,
      `Email: ${data.email}`,
      `Service: ${cap(data.service)}`,
      `Car: ${cap(data.car)}`,
      `Pickup: ${data.pickup}`,
      `Date: ${data.date} ${data.time}`,
      data.service === "outstation" ? `Days: ${data.days}` : null,
      data.notes && data.notes !== "-" ? `Notes: ${data.notes}` : null,
    ].filter(Boolean);

    const plain = lines.join("\n");
    const encoded = encodeURIComponent(plain);

    // Save locally (optional audit)
    try {
      const key = "rt_bookings";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.unshift({ ...data, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
    } catch (_) {}

    // Send via EmailJS (if configured)
    let emailOk = false;
    if (typeof emailjs !== "undefined" && EMAILJS_CFG.serviceId && EMAILJS_CFG.templateId) {
      try {
        await emailjs.send(EMAILJS_CFG.serviceId, EMAILJS_CFG.templateId, {
          name: data.name,
          phone: data.phone,
          email: data.email,
          service: cap(data.service),
          car: cap(data.car),
          pickup: data.pickup,
          date: data.date,
          time: data.time,
          days: data.days,
          notes: data.notes,
          message: plain, // handy single field
        });
        emailOk = true;
      } catch (err) {
        console.error("EmailJS error:", err);
      }
    }

// WhatsApp link
const wa = `https://wa.me/${WA_NUMBER}?text=${encoded}`;

// Show Thank You modal instead of opening WA immediately
const modal = document.getElementById("bookingSuccessModal");
modal.classList.add("show");

// When OK clicked → open WhatsApp
document.getElementById("okBookingBtn").onclick = () => {
  window.open(wa, "_blank", "noopener");
  modal.classList.remove("show");
  form.reset();
  render(""); // clear dynamic
};

// Close modal with X
document.getElementById("closeBookingModal").onclick = () => {
  modal.classList.remove("show");
};

  });

  function cap(s) { return String(s || "").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()); }
})();
//for review link
document.addEventListener("DOMContentLoaded", () => {
  loadReviews();

  // 🔗 Auto open review modal if link contains #writeReview
  if (window.location.hash === "#writeReview") {
    document.getElementById("reviewModal").classList.add("show");
  }
});
