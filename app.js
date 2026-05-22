// import L from "leaflet";
// import "leaflet/dist/leaflet.css";

const CATEGORIES = {
  home: { label: "Home", color: "#3b82f6" },
  flights: { label: "Flights", color: "#8b5cf6" },
  stays: { label: "Stays", color: "#10b981" },
  attractions: { label: "Attractions", color: "#f59e0b" },
};

const NOMINATIM_EMAIL = "trip-mapper@users.noreply.github.com";

let activeCategory = "home";
let editingStopId = null;
let tripMap = null;
let geocodeQueue = Promise.resolve();
const stops = [];

const form = document.getElementById("stop-form");
const submitBtn = document.getElementById("submit-stop");
const cancelEditBtn = document.getElementById("cancel-edit");
const locationInput = document.getElementById("location");
const commentsInput = document.getElementById("comments");
const locationField = document.getElementById("location-field");
const locationError = document.getElementById("location-error");
const colorInput = document.getElementById("color");
const colorHexInput = document.getElementById("color-hex");
const formToast = document.getElementById("form-toast");
const stopsList = document.getElementById("stops-list");
const stopsEmpty = document.getElementById("stops-empty");
const stopsSectionTitle = document.querySelector(".stops-section h2");
const leftsidebarTitle = document.getElementById("left-sidebar-title");
const leftsidebarSubtitle = document.getElementById("left-sidebar-subtitle");
const navbarTabs = document.querySelectorAll(".navbar-tab");

navbarTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    cancelEdit();
    setActiveCategory(tab.dataset.category);
  });
});

cancelEditBtn.addEventListener("click", cancelEdit);

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
  const comments = commentsInput.value.trim();
  const color = colorInput.value;

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

  const isEdit = editingStopId != null;
  const existingStop = isEdit ? stops.find((s) => s.id === editingStopId) : null;

  if (isEdit && !existingStop) {
    cancelEdit();
    setFormLoading(false);
    return;
  }

  showToast(isEdit ? "Updating location…" : "Finding location…");

  try {
    const locationChanged = !isEdit || existingStop.location !== location;
    let lat = existingStop?.lat;
    let lng = existingStop?.lng;

    if (locationChanged) {
      const coords = await geocodeAddress(location);
      lat = coords.lat;
      lng = coords.lng;
    }

    if (isEdit) {
      existingStop.location = location;
      existingStop.comments = comments;
      existingStop.color = color;
      existingStop.lat = lat;
      existingStop.lng = lng;

      if (existingStop.marker) {
        existingStop.marker.setLatLng([lat, lng]);
        existingStop.marker.setStyle({ fillColor: color });
        updateMarkerPopup(existingStop);
      }

      cancelEdit();
      showToast("Stop updated.");
    } else {
      const stop = {
        id: crypto.randomUUID(),
        category: activeCategory,
        location,
        comments,
        color,
        lat,
        lng,
        marker: null,
      };
      stop.marker = createMarker(stop);
      stops.push(stop);
      resetFormFields();
      showToast(`Added to ${CATEGORIES[activeCategory].label}.`);
    }

    updateMarkerVisibility();
    fitMapToVisibleMarkers();
    renderStopsList();
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
  cancelEditBtn.disabled = loading;
  locationInput.disabled = loading;
  commentsInput.disabled = loading;
}

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

function buildPopupHtml(stop) {
  const categoryLabel = CATEGORIES[stop.category]?.label ?? stop.category;
  let html = `<strong>${categoryLabel}</strong><br>${escapeHtml(stop.location)}`;
  if (stop.comments) {
    html += `<br><span style="opacity:0.85">${escapeHtml(stop.comments)}</span>`;
  }
  return html;
}

function createMarker(stop) {
  const marker = L.circleMarker([stop.lat, stop.lng], {
    radius: 10,
    fillColor: stop.color,
    color: "#ffffff",
    weight: 2,
    fillOpacity: 1,
  });

  marker.bindPopup(buildPopupHtml(stop));
  return marker;
}

function updateMarkerPopup(stop) {
  if (stop.marker) {
    stop.marker.setPopupContent(buildPopupHtml(stop));
  }
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

function startEdit(stop) {
  editingStopId = stop.id;
  locationInput.value = stop.location;
  commentsInput.value = stop.comments || "";
  colorInput.value = stop.color;
  colorHexInput.value = stop.color;

  form.classList.add("is-editing");
  cancelEditBtn.hidden = false;
  submitBtn.textContent = "Save changes";
  leftsidebarSubtitle.textContent = `Editing ${stop.location}`;

  clearLocationError();
  renderStopsList();
  locationInput.focus();
}

function cancelEdit() {
  if (!editingStopId) return;

  editingStopId = null;
  form.classList.remove("is-editing");
  cancelEditBtn.hidden = true;
  submitBtn.textContent = "Add to map";
  resetFormFields();
  clearLocationError();

  const { label, color } = CATEGORIES[activeCategory];
  if (activeCategory === "home") {
    leftsidebarSubtitle.textContent = "Add stops to your trip on the map.";
  } else {
    leftsidebarSubtitle.textContent = `Add ${label.toLowerCase()} to your map.`;
  }

  renderStopsList();
}

function resetFormFields() {
  locationInput.value = "";
  commentsInput.value = "";
  const { color } = CATEGORIES[activeCategory];
  colorInput.value = color;
  colorHexInput.value = color;
}

function deleteStop(stop) {
  if (editingStopId === stop.id) {
    cancelEdit();
  }

  if (stop.marker && tripMap) {
    tripMap.removeLayer(stop.marker);
  }

  const index = stops.findIndex((s) => s.id === stop.id);
  if (index !== -1) {
    stops.splice(index, 1);
  }

  updateMarkerVisibility();
  fitMapToVisibleMarkers();
  renderStopsList();
  showToast("Stop removed.");
}

function setActiveCategory(category) {
  if (!CATEGORIES[category]) return;

  activeCategory = category;

  navbarTabs.forEach((tab) => {
    const isActive = tab.dataset.category === category;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (!editingStopId) {
    const { label, color } = CATEGORIES[category];
    colorInput.value = color;
    colorHexInput.value = color;

    if (category === "home") {
      leftsidebarTitle.textContent = "Your trip";
      leftsidebarSubtitle.textContent = "Add stops to your trip on the map.";
      stopsSectionTitle.textContent = "All stops";
    } else {
      leftsidebarTitle.textContent = label;
      leftsidebarSubtitle.textContent = `Add ${label.toLowerCase()} to your map.`;
      stopsSectionTitle.textContent = `Your ${label.toLowerCase()}`;
    }
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
    if (stop.id === editingStopId) {
      li.classList.add("is-editing");
    }

    const dot = document.createElement("span");
    dot.className = "stop-color";
    dot.style.backgroundColor = stop.color;
    dot.setAttribute("aria-hidden", "true");

    const main = document.createElement("div");
    main.className = "stop-main";
    main.title = "Show on map";

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

    if (stop.comments) {
      const commentEl = document.createElement("div");
      commentEl.className = "stop-comments";
      commentEl.textContent = stop.comments;
      details.appendChild(commentEl);
    }

    main.appendChild(details);
    main.addEventListener("click", () => focusStop(stop));

    const actions = document.createElement("div");
    actions.className = "stop-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "stop-action-btn stop-action-btn--edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startEdit(stop);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "stop-action-btn stop-action-btn--delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteStop(stop);
    });

    actions.append(editBtn, deleteBtn);
    li.append(dot, main, actions);
    stopsList.appendChild(li);
  });
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  tripMap = L.map(mapEl, { zoomControl: true }).setView([48.8566, 2.3522], 4);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(tripMap);

  window.tripMap = tripMap;

  window.tripMap = tripMap;

  setTimeout(() => {
    tripMap.invalidateSize();
  }, 100);
}

setActiveCategory("home");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMap);
} else {
  initMap();
}