const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const CATEGORIES = {
  home: { label: "Home", color: "#3b82f6" },
  flights: { label: "Flights", color: "#8b5cf6" },
  stays: { label: "Stays", color: "#10b981" },
  attractions: { label: "Attractions", color: "#f59e0b" },
};

let activeCategory = "home";
const stops = [];

const form = document.getElementById("stop-form");
const locationInput = document.getElementById("location");
const locationField = document.getElementById("location-field");
const locationError = document.getElementById("location-error");
const colorInput = document.getElementById("color");
const colorHexInput = document.getElementById("color-hex");
const formToast = document.getElementById("form-toast");
const stopsList = document.getElementById("stops-list");
const stopsEmpty = document.getElementById("stops-empty");
const stopsSectionTitle = document.querySelector(".stops-section h2");
const sidebarTitle = document.getElementById("sidebar-title");
const sidebarSubtitle = document.getElementById("sidebar-subtitle");
const mapPlaceholder = document.getElementById("map-placeholder");
const navbarTabs = document.querySelectorAll(".navbar-tab");

navbarTabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveCategory(tab.dataset.category));
});

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

  const location = locationInput.value.trim();
  const color = colorInput.value;
  const category = activeCategory;

  if (!location) {
    locationField.classList.add("field--error");
    locationError.textContent = "Location is required.";
    locationInput.focus();
    return;
  }

  clearLocationError();
  addStop({ category, location, color });
  showToast(`Added to ${CATEGORIES[category].label}.`);
  locationInput.value = "";
  locationInput.focus();
});

locationInput.addEventListener("input", () => {
  if (locationInput.value.trim()) {
    clearLocationError();
  }
});

function setActiveCategory(category) {
  if (!CATEGORIES[category]) return;

  activeCategory = category;

  navbarTabs.forEach((tab) => {
    const isActive = tab.dataset.category === category;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const { label, color } = CATEGORIES[category];
  colorInput.value = color;
  colorHexInput.value = color;

  if (category === "home") {
    sidebarTitle.textContent = "Your trip";
    sidebarSubtitle.textContent = "Add stops to your trip on the map.";
    stopsSectionTitle.textContent = "All stops";
  } else {
    sidebarTitle.textContent = label;
    sidebarSubtitle.textContent = `Add ${label.toLowerCase()} to your map.`;
    stopsSectionTitle.textContent = `Your ${label.toLowerCase()}`;
  }

  renderStopsList();
}

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

function getVisibleStops() {
  if (activeCategory === "home") return stops;
  return stops.filter((stop) => stop.category === activeCategory);
}

function renderStopsList() {
  const visible = getVisibleStops();
  const hasStops = visible.length > 0;
  stopsEmpty.hidden = hasStops;

  if (!hasStops) {
    stopsEmpty.textContent =
      activeCategory === "home"
        ? "No stops yet. Add a location above."
        : `No ${CATEGORIES[activeCategory].label.toLowerCase()} yet. Add one above.`;
  }

  stopsList.querySelectorAll(".stop-item").forEach((el) => el.remove());

  visible.forEach((stop) => {
    const li = document.createElement("li");
    li.className = "stop-item";

    const dot = document.createElement("span");
    dot.className = "stop-color";
    dot.style.backgroundColor = stop.color;
    dot.setAttribute("aria-hidden", "true");

    const details = document.createElement("div");
    details.className = "stop-details";

    if (activeCategory === "home") {
      const cat = document.createElement("div");
      cat.className = "stop-category";
      cat.textContent = CATEGORIES[stop.category]?.label ?? stop.category;
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

setActiveCategory("home");
loadGoogleMaps();
