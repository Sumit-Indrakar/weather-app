const API_KEY = '5a2db3de5f3e60ecfedda7cc872abfc5'; // <-- put your key here

  /* Utilities */
  const $ = id => document.getElementById(id);
  const kelvinToC = k => k - 273.15;
  const cToF = c => (c * 9/5) + 32;
  const round = (n, d=1) => Math.round(n * Math.pow(10,d)) / Math.pow(10,d);

  /* State */
  let unit = 'C';
  let debounceTimer = null;

  /* Elements */
  const q = $('q');
  const searchBtn = $('searchBtn');
  const locBtn = $('locBtn');
  const unitBtn = $('unitBtn');
  const recentEl = $('recent');
  const errorEl = $('error');
  const loader = $('loader');
  const currentBlock = $('currentBlock');

  const locName = $('locName');
  const coords = $('coords');
  const tempNow = $('tempNow');
  const desc = $('desc');
  const iconNow = $('iconNow');
  const tempLarge = $('tempLarge');
  const feels = $('feels');
  const hum = $('hum');
  const wind = $('wind');
  const pres = $('pres');
  const vis = $('vis');
  const outlook = $('outlook');

  /* Recent searches */
  function loadRecent(){
    try{ return JSON.parse(localStorage.getItem('weather:recent')||'[]'); }catch{ return []; }
  }
  function saveRecent(list){ localStorage.setItem('weather:recent', JSON.stringify(list.slice(0,6))); }
  function renderRecent(){
    const list = loadRecent();
    recentEl.innerHTML = '';
    if(list.length===0){ recentEl.innerHTML = '<div class="small" style="color:#94a3b8">No recent searches</div>'; return; }
    list.forEach(city => {
      const b = document.createElement('button'); b.className='chip'; b.textContent = city; b.onclick = () => { q.value=city; fetchByCity(city); }
      recentEl.appendChild(b);
    });
  }

  function addRecent(city){
    const list = loadRecent();
    const nxt = [city, ...list.filter(x=>x.toLowerCase()!==city.toLowerCase())];
    saveRecent(nxt);
    renderRecent();
  }

  /* UI helpers */
  function showError(msg){ errorEl.style.display='block'; errorEl.textContent = msg; }
  function clearError(){ errorEl.style.display='none'; errorEl.textContent=''; }
  function showLoader(){ loader.style.display='flex'; }
  function hideLoader(){ loader.style.display='none'; }

  function displayTempK(k){
    const c = kelvinToC(k);
    if(unit==='C') return `${round(c,1)}°C`;
    return `${round(cToF(c),1)}°F`;
  }

  /* Fetching */
  async function fetchByCity(cityName){
    clearError(); showLoader(); currentBlock.style.display='none';
    try{
      const cwRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${API_KEY}`);
      if(!cwRes.ok) throw new Error('City not found');
      const cw = await cwRes.json();
      renderCurrent(cw);

      const foRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cityName)}&appid=${API_KEY}`);
      if(!foRes.ok) throw new Error('Forecast not available');
      const fo = await foRes.json();
      const daily = summarizeForecast(fo.list);
      renderForecast(daily);
      addRecent(cw.name);
    }catch(err){
      console.error(err); showError(err.message || 'Failed to fetch weather');
    }finally{ hideLoader(); }
  }

  async function fetchByCoords(lat, lon){
    clearError(); showLoader(); currentBlock.style.display='none';
    try{
      const cwRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
      if(!cwRes.ok) throw new Error('Location weather not found');
      const cw = await cwRes.json(); renderCurrent(cw);

      const foRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
      if(!foRes.ok) throw new Error('Forecast not available');
      const fo = await foRes.json(); renderForecast(summarizeForecast(fo.list));
      addRecent(cw.name);
    }catch(err){ console.error(err); showError(err.message || 'Failed to fetch weather'); }
    finally{ hideLoader(); }
  }

  function renderCurrent(cw){
    locName.textContent = `${cw.name}${cw.sys && cw.sys.country ? ', '+cw.sys.country : ''}`;
    coords.textContent = `Lat ${round(cw.coord.lat,2)} • Lon ${round(cw.coord.lon,2)}`;
    tempNow.textContent = displayTempK(cw.main.temp);
    desc.textContent = cw.weather[0].description;
    iconNow.src = `https://openweathermap.org/img/wn/${cw.weather[0].icon}@2x.png`;
    iconNow.alt = cw.weather[0].description || '';
    tempLarge.textContent = displayTempK(cw.main.temp);
    feels.textContent = `Feels like ${displayTempK(cw.main.feels_like)}`;
    hum.textContent = `${cw.main.humidity}%`;
    wind.textContent = `${cw.wind.speed} m/s`;
    pres.textContent = `${cw.main.pressure} hPa`;
    vis.textContent = `${(cw.visibility||0)/1000} km`;
    currentBlock.style.display='block';
  }

  function summarizeForecast(list){
    const days = {};
    list.forEach(item => {
      const d = new Date(item.dt * 1000);
      const key = d.toISOString().slice(0,10);
      if(!days[key]) days[key]=[];
      days[key].push(item);
    });
    return Object.keys(days).slice(0,6).map(dateKey => {
      const items = days[dateKey];
      // pick item closest to 12:00 localtime
      let midday = items.reduce((a,b)=> Math.abs((new Date(a.dt*1000)).getUTCHours()-12) < Math.abs((new Date(b.dt*1000)).getUTCHours()-12) ? a : b);
      const temps = items.map(i=>i.main.temp);
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const freq = {}; items.forEach(i=>{ const w=i.weather[0].main; freq[w]=(freq[w]||0)+1; });
      const common = Object.keys(freq).reduce((a,b)=> freq[a]>freq[b]?a:b);
      return { date: dateKey, label: new Date(dateKey).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}), tempMin: min, tempMax: max, icon: midday.weather[0].icon, description: midday.weather[0].description, main: common };
    });
  }

  function renderForecast(daily){
    outlook.innerHTML='';
    daily.slice(0,5).forEach(d => {
      const el = document.createElement('div'); el.className='day';
      el.innerHTML = `<small>${d.label}</small><img src="https://openweathermap.org/img/wn/${d.icon}@2x.png" alt="${d.description}" style="width:64px;height:64px;display:block;margin:6px auto" /><div class="range">${formatRange(d.tempMax,d.tempMin)}</div><div class="small" style="text-transform:capitalize">${d.description}</div>`;
      outlook.appendChild(el);
    });
  }

  function formatRange(maxK,minK){
    if(unit==='C') return `${round(kelvinToC(maxK),1)}° / ${round(kelvinToC(minK),1)}°`;
    return `${round(cToF(kelvinToC(maxK)),1)}° / ${round(cToF(kelvinToC(minK)),1)}°`;
  }

  /* Event wiring */
  q.addEventListener('input', (e)=>{
    clearError();
    clearTimeout(debounceTimer);
    const v = e.target.value;
    if(!v || v.trim().length<2) return;
    debounceTimer = setTimeout(()=>{ fetchByCity(v.trim()); }, 650);
  });
  searchBtn.addEventListener('click', ()=>{ const v=q.value.trim(); if(v) fetchByCity(v); });

  unitBtn.addEventListener('click', ()=>{
    unit = unit==='C' ? 'F' : 'C'; unitBtn.textContent = '°' + unit;
    // update UI values if present
    const currentTempText = tempNow.textContent;
    // re-render entire page by re-calling search with current location if possible
    // simplest: if locName has value, use it
    const name = locName.textContent; if(name && name!=='—'){
      // try to fetch again using displayed city (non-blocking)
      // If API key missing, this will show error
      fetchByCity(name.split(',')[0]);
    }
  });

  locBtn.addEventListener('click', ()=>{
    if(!navigator.geolocation){ showError('Geolocation not supported by this browser.'); return; }
    showLoader(); navigator.geolocation.getCurrentPosition(pos=>{ fetchByCoords(pos.coords.latitude, pos.coords.longitude); }, err=>{ showError('Permission denied or location unavailable.'); hideLoader(); });
  });

  // init
  renderRecent();
  // load a friendly default city if nothing done
  window.addEventListener('load', ()=>{ if(!loadRecent().length){ fetchByCity('New Delhi'); } });
