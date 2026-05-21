const CATEGORIES = {
  home: { label: "Home", color: "#3b82f6" },
  flights: { label: "Flights", color: "#8b5cf6" },
  stays: { label: "Stays", color: "#10b981" },
  attractions: { label: "Attractions", color: "#f59e0b" },
};

/** Used to identify this app to Nominatim (required by their usage policy). */
const NOMINATIM_EMAIL = "trip-mapper@users.noreply.github.com";

let activeCategory = "home";
let tripMap = null;
let geocodeQueue = Promise.resolve();
const stops = [];

const form = document.getElementById("stop-form");
const submitBtn = form.querySelector(".btn-add");
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

form.addEventListener("submit", async (e) => {
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

  if (!tripMap) {
    showToast("Map is still loading. Try again in a moment.");
    return;
  }

  clearLocationError();
  setFormLoading(true);
  showToast("Finding location…");

  try {
    const coords = await geocodeAddress(location);
    const stop = {
      id: crypto.randomUUID(),
      category,
      location,
      color,
      lat: coords.lat,
      lng: coords.lng,
      marker: null,
    };
    stop.marker = createMarker(stop);
    stops.push(stop);
    locationInput.value = "";
    updateMarkerVisibility();
    fitMapToVisibleMarkers();
    renderStopsList();
    showToast(`Added to ${CATEGORIES[category].label}.`);
    locationInput.focus();
  } catch (err) {
    locationField.classList.add("field--error");
    locationError.textContent =
      err.message === "ZERO_RESULTS"
        ? "Could not find that location. Try a more specific address."
        : "Could not place this location on the map. Check your connection or try again.";
    showToast("Location not found on map.");
  } finally {
    setFormLoading(false);
  }
});

locationInput.addEventListener("input", () => {
  if (locationInput.value.trim()) {
    clearLocationError();
  }
});

function setFormLoading(loading) {
  submitBtn.disabled = loading;
  locationInput.disabled = loading;
}

/** Nominatim allows max 1 request/second on the public server. */
function geocodeAddress(address) {
  geocodeQueue = geocodeQueue
    .then(() => new Promise((r) => setTimeout(r, 1100)))
    .then(() => fetchNominatim(address));
  return geocodeQueue;
}

async function fetchNominatim(address) {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    email: NOMINATIM_EMAIL,
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) {
    throw new Error("NETWORK");
  }

  const results = await response.json();
  if (!results.length) {
    throw new Error("ZERO_RESULTS");
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  };
}

function createMarker(stop) {
  const categoryLabel = CATEGORIES[stop.category]?.label ?? stop.category;

  const marker = L.circleMarker([stop.lat, stop.lng], {
    radius: 10,
    fillColor: stop.color,
    color: "#ffffff",
    weight: 2,
    fillOpacity: 1,
  });

  marker.bindPopup(
    `<strong>${categoryLabel}</strong><br>${escapeHtml(stop.location)}`
  );

  return marker;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateMarkerVisibility() {
  const visibleIds = new Set(getVisibleStops().map((s) => s.id));

  stops.forEach((stop) => {
    if (!stop.marker) return;

    if (visibleIds.has(stop.id)) {
      if (!tripMap.hasLayer(stop.marker)) {
        stop.marker.addTo(tripMap);
      }
    } else if (tripMap.hasLayer(stop.marker)) {
      tripMap.removeLayer(stop.marker);
    }
  });
}

function fitMapToVisibleMarkers() {
  const visible = getVisibleStops().filter((s) => s.lat != null);
  if (!visible.length || !tripMap) return;

  if (visible.length === 1) {
    tripMap.setView([visible[0].lat, visible[0].lng], 12);
    return;
  }

  const bounds = L.latLngBounds(visible.map((s) => [s.lat, s.lng]));
  tripMap.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
}

function focusStop(stop) {
  if (!tripMap || stop.lat == null) return;
  tripMap.setView([stop.lat, stop.lng], Math.max(tripMap.getZoom(), 12));
  if (stop.marker) {
    stop.marker.openPopup();
  }
}

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

  updateMarkerVisibility();
  fitMapToVisibleMarkers();
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
    li.title = "Show on map";

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
    li.addEventListener("click", () => focusStop(stop));
    stopsList.appendChild(li);
  });
}

function initMap() {
  tripMap = L.map("map", { zoomControl: true }).setView([48.8566, 2.3522], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(tripMap);

  window.tripMap = tripMap;
}

setActiveCategory("home");

if (typeof L !== "undefined") {
  initMap();
} else {
  console.error("Leaflet failed to load.");
}
