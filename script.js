/* Interactive Weather Dashboard
   - Replace YOUR_API_KEY_HERE with your OpenWeatherMap API key
*/

const API_KEY = "5a2db3de5f3e60ecfedda7cc872abfc5"; // <<<--- put your API key here

// Elements
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const geoBtn = document.getElementById("geoBtn");
const card = document.getElementById("card");
const loader = document.getElementById("loader");
const cityName = document.getElementById("cityName");
const dateTime = document.getElementById("dateTime");
const descriptionEl = document.getElementById("description");
const weatherIcon = document.getElementById("weatherIcon");
const tempEl = document.getElementById("temp");
const feelsLikeEl = document.getElementById("feelsLike");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");
const pressureEl = document.getElementById("pressure");
const forecastEl = document.getElementById("forecast");
const unitToggle = document.getElementById("unitToggle");
const unitLabel = document.getElementById("unitLabel");

// Persisted settings
const storage = window.localStorage;
let unit = storage.getItem("unit") || "metric"; // metric = Celsius, imperial = Fahrenheit
unitToggle.checked = unit === "imperial";
unitLabel.textContent = unit === "metric" ? "°C" : "°F";

let lastCity = storage.getItem("lastCity") || "";

// Helper: show & hide loader
function showLoader(show = true) {
  loader.classList.toggle("hidden", !show);
}

// Helper: format unix timestamp to HH:MM (local)
function formatTime(ts, tzOffset = 0) {
  // ts is in seconds, tzOffset in seconds
  const d = new Date((ts + tzOffset) * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Helper: get weekday name
function weekdayName(ts, tzOffset = 0) {
  const d = new Date((ts + tzOffset) * 1000);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

// Background by weather
function setBackground(condition) {
  const body = document.body;
  // condition -> main weather text like 'Clear', 'Clouds', 'Rain', etc.
  let gradient;
  switch ((condition || "").toLowerCase()) {
    case "clear":
      gradient = "linear-gradient(180deg,#0b3a66 0%, #0f1724 100%)";
      break;
    case "clouds":
      gradient = "linear-gradient(180deg,#2b3a4a 0%, #0f1724 100%)";
      break;
    case "rain":
    case "drizzle":
      gradient = "linear-gradient(180deg,#1b2a35 0%, #071524 100%)";
      break;
    case "thunderstorm":
      gradient = "linear-gradient(180deg,#341f3f 0%, #071024 100%)";
      break;
    case "snow":
      gradient = "linear-gradient(180deg,#2b3b4b 0%, #8eaec6 60%)";
      break;
    default:
      gradient = "linear-gradient(180deg,#071024 0%, #0f1724 60%)";
  }
  body.style.background = gradient;
}

// Fetch weather by coordinates (get current + daily forecast via One Call)
async function fetchWeatherByCoords(lat, lon, units = unit) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("Please set your OpenWeather API key in script.js (API_KEY).");
  }

  // current weather (for name & timezone offset) - use /weather endpoint for city name
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
  const weatherResp = await fetch(weatherUrl);
  if (!weatherResp.ok) throw new Error("Unable to fetch weather (current).");
  const weatherData = await weatherResp.json();

  const onecallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&units=${units}&exclude=minutely,hourly,alerts&appid=${API_KEY}`;
  const onecallResp = await fetch(onecallUrl);
  if (!onecallResp.ok) throw new Error("Unable to fetch forecast.");
  const onecallData = await onecallResp.json();

  // merge essential pieces
  return {
    currentWeather: weatherData,
    onecall: onecallData
  };
}

// Fetch weather by city name
async function fetchWeatherByCity(cityNameStr, units = unit) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("Please set your OpenWeather API key in script.js (API_KEY).");
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityNameStr)}&units=${units}&appid=${API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("City not found. Try a different name.");
    throw new Error("Unable to fetch weather.");
  }
  const data = await resp.json();
  // now fetch onecall by coords
  const { coord } = data;
  const onecallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${coord.lat}&lon=${coord.lon}&units=${units}&exclude=minutely,hourly,alerts&appid=${API_KEY}`;
  const onecallResp = await fetch(onecallUrl);
  if (!onecallResp.ok) throw new Error("Unable to fetch forecast.");
  const onecallData = await onecallResp.json();

  return {
    currentWeather: data,
    onecall: onecallData
  };
}

// Render UI
function renderAll(payload) {
  const { currentWeather, onecall } = payload;
  card.classList.remove("hidden");

  const tzOffset = (onecall.timezone_offset || 0); // seconds
  const now = new Date();
  cityName.textContent = `${currentWeather.name}, ${currentWeather.sys?.country || ""}`;
  dateTime.textContent = now.toLocaleString();
  descriptionEl.textContent = currentWeather.weather?.[0]?.description || "";
  const iconCode = currentWeather.weather?.[0]?.icon;
  weatherIcon.src = iconCode ? `https://openweathermap.org/img/wn/${iconCode}@2x.png` : "";
  weatherIcon.alt = currentWeather.weather?.[0]?.main || "weather";

  const tempVal = Math.round(currentWeather.main.temp);
  tempEl.textContent = `${tempVal}°`;
  feelsLikeEl.textContent = `Feels like: ${Math.round(currentWeather.main.feels_like)}°`;
  humidityEl.textContent = `Humidity: ${currentWeather.main.humidity}%`;
  windEl.textContent = `Wind: ${currentWeather.wind.speed} m/s`;
  sunriseEl.textContent = formatTime(currentWeather.sys.sunrise, tzOffset);
  sunsetEl.textContent = formatTime(currentWeather.sys.sunset, tzOffset);
  pressureEl.textContent = `${currentWeather.main.pressure} hPa`;

  // background
  setBackground(currentWeather.weather?.[0]?.main);

  // Forecast (daily) - use onecall.daily (first 7 days)
  forecastEl.innerHTML = "";
  const daily = onecall.daily || [];
  daily.slice(0, 7).forEach(day => {
    const dName = weekdayName(day.dt, tzOffset);
    const icon = day.weather?.[0]?.icon;
    const min = Math.round(day.temp.min);
    const max = Math.round(day.temp.max);
    const card = document.createElement("div");
    card.className = "day";
    card.innerHTML = `
      <div class="day-name">${dName}</div>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${day.weather?.[0]?.main || ''}" />
      <div class="minmax">${max}° / ${min}°</div>
      <div class="muted" style="color:var(--muted);font-size:12px; margin-top:6px;">${day.weather?.[0]?.main}</div>
    `;
    forecastEl.appendChild(card);
  });
}

// Search handler
async function handleSearch(city) {
  try {
    showLoader(true);
    const data = await fetchWeatherByCity(city);
    renderAll(data);
    storage.setItem("lastCity", city);
  } catch (err) {
    alert(err.message || "Error fetching weather");
  } finally {
    showLoader(false);
  }
}

// Geolocation handler
async function handleGeolocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  showLoader(true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const data = await fetchWeatherByCoords(lat, lon);
      renderAll(data);
      storage.setItem("lastCity", `${data.currentWeather.name}`);
    } catch (err) {
      alert(err.message || "Error fetching weather for location.");
    } finally {
      showLoader(false);
    }
  }, (err) => {
    showLoader(false);
    alert("Unable to get your location: " + (err.message || "Permission denied"));
  }, { timeout: 10000 });
}

// Unit toggle
unitToggle.addEventListener("change", () => {
  unit = unitToggle.checked ? "imperial" : "metric";
  unitLabel.textContent = unit === "metric" ? "°C" : "°F";
  storage.setItem("unit", unit);
  // re-run last search if any
  const city = storage.getItem("lastCity");
  if (city) {
    // re-fetch with new unit; do not ask user
    (async () => {
      showLoader(true);
      try {
        const data = await fetchWeatherByCity(city, unit);
        renderAll(data);
      } catch (err) {
        console.error(err);
      } finally {
        showLoader(false);
      }
    })();
  }
});

searchBtn.addEventListener("click", () => {
  const val = cityInput.value.trim();
  if (!val) return;
  handleSearch(val);
});
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});
geoBtn.addEventListener("click", () => handleGeolocation());

// On load: try last city
window.addEventListener("load", async () => {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    // show card hidden but give clear instruction overlay
    card.classList.add("hidden");
    alert("Please add your OpenWeather API key in script.js (API_KEY) to enable fetching weather data.");
    return;
  }
  if (lastCity) {
    showLoader(true);
    try {
      const data = await fetchWeatherByCity(lastCity);
      renderAll(data);
    } catch (err) {
      console.warn("Failed to load last city:", err);
    } finally {
      showLoader(false);
    }
  }
});