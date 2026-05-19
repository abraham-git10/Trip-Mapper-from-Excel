const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const stops = [];
const form = document.getElementById("stop-form");
const categoryInput = document.getElementById("category");
const locationInput = document.getElementById("location");
const locationField = document.getElementById("location-field");
const locationError = document.getElementById("location-error");
const colorInput = document.getElementById("color");
const colorHexInput = document.getElementById("color-hex");
const formToast = document.getElementById("form-toast");
const stopsList = document.getElementById("stops-list");
const stopsEmpty = document.getElementById("stops-empty");
const mapPlaceholder = document.getElementById("map-placeholder");

colorInput.addEventListener("input", () => {
  colorHexInput.value = colorInput.value;
});

colorHexInput.addEventListener("input", () => {
  const hex = colorHexInput.value;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    colorInput.value = hex;
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const category = categoryInput.value.trim();
  const location = locationInput.value.trim();
  const color = colorInput.value;

  if (!location) {
    locationField.classList.add("field--error");
    locationError.textContent = "Location is required.";
    locationInput.focus();
    return;
  }

  clearLocationError();
  addStop({ category, location, color });
  showToast("Added to your trip list.");
  form.reset();
  colorInput.value = color;
  colorHexInput.value = color;
  categoryInput.focus();
});

locationInput.addEventListener("input", () => {
  if (locationInput.value.trim()) {
    clearLocationError();
  }
});

function clearLocationError() {
  locationField.classList.remove("field--error");
  locationError.textContent = "";
}

function showToast(message) {
  formToast.textContent = message;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    formToast.textContent = "";
  }, 2500);
}

function addStop(stop) {
  stops.push(stop);
  renderStopsList();
}

function renderStopsList() {
  const hasStops = stops.length > 0;
  stopsEmpty.hidden = hasStops;

  stopsList.querySelectorAll(".stop-item").forEach((el) => el.remove());

  stops.forEach((stop) => {
    const li = document.createElement("li");
    li.className = "stop-item";

    const dot = document.createElement("span");
    dot.className = "stop-color";
    dot.style.backgroundColor = stop.color;
    dot.setAttribute("aria-hidden", "true");

    const details = document.createElement("div");
    details.className = "stop-details";

    if (stop.category) {
      const cat = document.createElement("div");
      cat.className = "stop-category";
      cat.textContent = stop.category;
      details.appendChild(cat);
    }

    const loc = document.createElement("div");
    loc.className = "stop-location";
    loc.textContent = stop.location;
    details.appendChild(loc);

    li.append(dot, details);
    stopsList.appendChild(li);
  });
}

function initMap() {
  mapPlaceholder.classList.add("hidden");

  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 48.8566, lng: 2.3522 },
    zoom: 4,
    mapTypeControl: true,
    streetViewControl: true,
    fullscreenControl: true,
    zoomControl: true,
  });

  window.tripMap = map;
}

window.initMap = initMap;

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "your_api_key_here") {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.defer = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
  script.onerror = () => {
    mapPlaceholder.querySelector("div").innerHTML =
      "<p>Failed to load Google Maps. Check your API key and that Maps JavaScript API is enabled.</p>";
  };
  document.head.appendChild(script);
}

loadGoogleMaps();
