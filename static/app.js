/**
 * Watt2Do — Interactive Application Logic (Person C)
 * Implements:
 * - Mobile UI Screens (Scan, Loading, Result, Drop-offs, Impact, Profile)
 * - Native Camera & Canvas 1024px Downsampling
 * - POST /api/scan with Contract v1.1 validation
 * - Confidence ring calculation & damage alert banner
 * - Geolocation & GET /api/dropoffs
 * - Watt2DoMap.show("map", userLocation, results) integration
 * - Impact & Gamified Battery Gauge persistence
 * - Interactive "Watty" AI Recycling Helper
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const MAX_IMAGE_DIMENSION = 1024;
  const LOW_CONFIDENCE_THRESHOLD = 0.6;
  const STORAGE_KEY_IMPACT = 'watt2do_items_saved';
  const STORAGE_KEY_HISTORY = 'watt2do_scan_history';
  const DEFAULT_COORDS = { lat: 28.06, lng: -82.41 }; // USF Tampa area

  // --- Screens / Views ---
  const views = {
    scan: document.getElementById('view-scan'),
    loading: document.getElementById('view-loading'),
    result: document.getElementById('view-result'),
    dropoffs: document.getElementById('view-dropoffs'),
    impact: document.getElementById('view-impact'),
    profile: document.getElementById('view-profile'),
  };

  // --- DOM Elements ---
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');
  const btnMainScan = document.getElementById('btn-main-scan');
  const btnGalleryUpload = document.getElementById('btn-gallery-upload');
  const btnOpenImpact = document.getElementById('btn-open-impact');
  const homeImpactCount = document.getElementById('home-impact-count');

  // Loading
  const loadingSubMessage = document.getElementById('loading-sub-message');

  // Result Elements
  const lowConfidenceBanner = document.getElementById('low-confidence-banner');
  const confidentResultContent = document.getElementById('confident-result-content');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const matchRingProgress = document.getElementById('match-ring-progress');
  const matchPercentText = document.getElementById('match-percent-text');
  const resItemTitle = document.getElementById('res-item-title');
  const resBatteryPill = document.getElementById('res-battery-pill');
  const resCategoryPill = document.getElementById('res-category-pill');
  const resDamageBanner = document.getElementById('res-damage-banner');
  const resDamageDetail = document.getElementById('res-damage-detail');
  const resStepsList = document.getElementById('res-steps-list');
  const regularBinNotice = document.getElementById('regular-bin-notice');
  const btnFindDropoffs = document.getElementById('btn-find-dropoffs');
  const btnRescanItem = document.getElementById('btn-rescan-item');

  // Drop-off Elements
  const gpsAreaLabel = document.getElementById('gps-area-label');
  const btnUpdateLocation = document.getElementById('btn-update-location');
  const placesCardsList = document.getElementById('places-cards-list');
  const placesLoadingIndicator = document.getElementById('places-loading-indicator');
  const placesEmptyState = document.getElementById('places-empty-state');
  const btnDropoffsDone = document.getElementById('btn-dropoffs-done');

  // Filter Chips
  const chipOpen = document.getElementById('filter-chip-open');
  const chipBatteries = document.getElementById('filter-chip-batteries');
  const chipEwaste = document.getElementById('filter-chip-ewaste');

  // Impact Elements
  const impactBigNumber = document.getElementById('impact-big-number');
  const batteryLevelSubtitle = document.getElementById('battery-level-subtitle');
  const btnImpactScanAnother = document.getElementById('btn-impact-scan-another');
  const milestoneFirst = document.getElementById('ms-first');
  const milestone5 = document.getElementById('ms-5items');
  const milestone10 = document.getElementById('ms-10items');

  // Profile Elements
  const headerProfileBtn = document.getElementById('header-profile-btn');
  const brandHomeBtn = document.getElementById('brand-home-btn');
  const profileItemsCount = document.getElementById('profile-items-count');
  const profileLevelVal = document.getElementById('profile-level-val');
  const profileNextScanDesc = document.getElementById('profile-next-scan-desc');
  const btnSignOut = document.getElementById('btn-sign-out');

  // Navigation Tabs
  const tabBtnHome = document.getElementById('tab-btn-home');
  const tabBtnProfile = document.getElementById('tab-btn-profile');

  // Error Toast
  const errorToast = document.getElementById('error-toast');
  const errorToastText = document.getElementById('error-toast-text');
  const errorDismissBtn = document.getElementById('error-dismiss-btn');

  // Watty Chat Elements
  const wattyTrigger = document.getElementById('watty-floating-trigger');
  const wattyModal = document.getElementById('watty-modal');
  const btnCloseWatty = document.getElementById('btn-close-watty');
  const wattyMessagesContainer = document.getElementById('watty-messages-container');
  const wattyChatForm = document.getElementById('watty-chat-form');
  const wattyInput = document.getElementById('watty-input');
  const quickChips = document.querySelectorAll('.quick-chip');

  // --- Runtime State ---
  let currentScanData = null;
  let cachedUserLocation = null;
  let activeDropoffs = [];
  let filterOnlyOpen = true;
  let activeFilterType = 'batteries';

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    updateImpactMetrics();
    setupEventListeners();
  }

  function setupEventListeners() {
    // Camera & Upload Triggers
    btnMainScan.addEventListener('click', () => {
      dismissError();
      cameraInput.click();
    });

    btnGalleryUpload.addEventListener('click', () => {
      dismissError();
      galleryInput.click();
    });

    cameraInput.addEventListener('change', handleFileSelected);
    galleryInput.addEventListener('change', handleFileSelected);

    // Result Actions
    btnRetakePhoto.addEventListener('click', () => switchScreen('scan'));
    btnRescanItem.addEventListener('click', () => switchScreen('scan'));
    btnFindDropoffs.addEventListener('click', () => {
      switchScreen('dropoffs');
      loadDropoffPoints();
    });

    // Dropoffs View Actions
    btnUpdateLocation.addEventListener('click', () => {
      cachedUserLocation = null;
      loadDropoffPoints();
    });

    btnDropoffsDone.addEventListener('click', () => {
      switchScreen('impact');
    });

    // Filter Chips
    chipOpen.addEventListener('click', () => {
      filterOnlyOpen = !filterOnlyOpen;
      chipOpen.classList.toggle('active', filterOnlyOpen);
      renderPlacesList();
    });

    chipBatteries.addEventListener('click', () => {
      activeFilterType = 'batteries';
      chipBatteries.classList.add('active');
      chipEwaste.classList.remove('active');
      loadDropoffPoints();
    });

    chipEwaste.addEventListener('click', () => {
      activeFilterType = 'ewaste';
      chipEwaste.classList.add('active');
      chipBatteries.classList.remove('active');
      loadDropoffPoints();
    });

    // Impact View Actions
    btnOpenImpact.addEventListener('click', () => switchScreen('impact'));
    btnImpactScanAnother.addEventListener('click', () => switchScreen('scan'));

    // Navigation & Tabs
    tabBtnHome.addEventListener('click', () => {
      setTabActive('home');
      switchScreen('scan');
    });

    tabBtnProfile.addEventListener('click', () => {
      setTabActive('profile');
      switchScreen('profile');
    });

    headerProfileBtn.addEventListener('click', () => {
      setTabActive('profile');
      switchScreen('profile');
    });

    brandHomeBtn.addEventListener('click', () => {
      setTabActive('home');
      switchScreen('scan');
    });

    btnSignOut.addEventListener('click', () => {
      showError('Signed out of guest profile session.');
      switchScreen('scan');
      setTabActive('home');
    });

    // Error dismiss
    errorDismissBtn.addEventListener('click', dismissError);

    // Watty Chat
    wattyTrigger.addEventListener('click', () => {
      wattyModal.classList.remove('hidden');
      wattyInput.focus();
    });

    btnCloseWatty.addEventListener('click', () => {
      wattyModal.classList.add('hidden');
    });

    wattyModal.addEventListener('click', (e) => {
      if (e.target === wattyModal) {
        wattyModal.classList.add('hidden');
      }
    });

    wattyChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleWattySubmit();
    });

    quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (query) {
          sendWattyMessage(query);
        }
      });
    });
  }

  // ==========================================================================
  // Screen Management
  // ==========================================================================
  function switchScreen(targetKey) {
    dismissError();

    Object.keys(views).forEach((key) => {
      if (views[key]) {
        views[key].classList.toggle('active', key === targetKey);
      }
    });

    if (targetKey === 'impact') {
      updateImpactMetrics();
    } else if (targetKey === 'profile') {
      updateProfileMetrics();
    } else if (targetKey === 'scan') {
      cameraInput.value = '';
      galleryInput.value = '';
      if (window.Watt2DoMap && typeof window.Watt2DoMap.clear === 'function') {
        try { window.Watt2DoMap.clear(); } catch (e) { /* ignore */ }
      }
    }
  }

  function setTabActive(tabName) {
    tabBtnHome.classList.toggle('active', tabName === 'home');
    tabBtnProfile.classList.toggle('active', tabName === 'profile');
  }

  // ==========================================================================
  // Image Capture & Canvas Downsampling (<= 1024px)
  // ==========================================================================
  async function handleFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Please select a valid JPEG or PNG image.');
      return;
    }

    try {
      switchScreen('loading');
      setLoadingText('Optimizing image for AI detection...');

      const resizedBlob = await downsampleImageCanvas(file, MAX_IMAGE_DIMENSION);

      setLoadingText('Analyzing chemistry & damage with Gemini...');
      const responseData = await postScanToBackend(resizedBlob);

      handleScanSuccess(responseData);
    } catch (err) {
      console.error('Scan failed:', err);
      showError(err.message || 'Unable to scan item. Please try again.');
      switchScreen('scan');
    }
  }

  function downsampleImageCanvas(file, maxDim) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas image conversion failed'));
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // ==========================================================================
  // API: POST /api/scan
  // ==========================================================================
  async function postScanToBackend(blob) {
    const formData = new FormData();
    formData.append('image', blob, 'scan.jpg');

    let res;
    try {
      res = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });
    } catch (networkError) {
      throw new Error('Connection error. Please check your internet connection.');
    }

    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      throw new Error('Invalid response from server.');
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Server error during scan');
    }

    return data;
  }

  // ==========================================================================
  // Result Display Logic
  // ==========================================================================
  function handleScanSuccess(data) {
    currentScanData = data;
    switchScreen('result');

    const confidence = typeof data.confidence === 'number' ? data.confidence : 0.95;

    // Task 3: Low confidence threshold check (< 0.6)
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidenceBanner.classList.remove('hidden');
      confidentResultContent.classList.add('hidden');
      return;
    }

    lowConfidenceBanner.classList.add('hidden');
    confidentResultContent.classList.remove('hidden');

    // 1. Confidence Ring Animation (circumference = 113.1 for r=18)
    const percentage = Math.round(confidence * 100);
    matchPercentText.textContent = `${percentage}%`;
    const circumference = 113.1;
    const offset = circumference * (1 - confidence);
    matchRingProgress.style.strokeDashoffset = offset.toString();

    // 2. Title & Type Pill
    resItemTitle.textContent = data.item || 'Battery';
    if (data.batteryType) {
      resBatteryPill.textContent = data.batteryType.replace(/_/g, '-');
      resBatteryPill.classList.remove('hidden');
    } else {
      resBatteryPill.classList.add('hidden');
    }
    resCategoryPill.textContent = data.category || 'battery';

    // 3. Red Hazard Warning Banner
    if (data.damaged === true) {
      resDamageBanner.classList.remove('hidden');
      resDamageDetail.textContent = data.damageNotes || 'swelling or structural leak detected';
    } else {
      resDamageBanner.classList.add('hidden');
    }

    // 4. Instructions List (Numbered pills 1, 2, 3)
    resStepsList.innerHTML = '';
    const instructions = Array.isArray(data.instructions) && data.instructions.length > 0
      ? data.instructions
      : [
          'Tape over the terminals with electrical tape.',
          'Store in a cool, non-flammable container.',
          'Never put it in household trash.'
        ];

    instructions.forEach((stepText, idx) => {
      const li = document.createElement('li');
      li.className = 'step-pill-item';

      const numSpan = document.createElement('span');
      numSpan.className = 'step-num-circle';
      numSpan.textContent = (idx + 1).toString();

      const textSpan = document.createElement('span');
      textSpan.className = 'step-text';
      textSpan.textContent = stepText;

      li.appendChild(numSpan);
      li.appendChild(textSpan);
      resStepsList.appendChild(li);
    });

    // 5. Regular bin vs Dropoff filter
    const filter = data.dropoffFilter || 'batteries';
    activeFilterType = filter === 'none' ? 'batteries' : filter;

    if (filter === 'none') {
      regularBinNotice.classList.remove('hidden');
      btnFindDropoffs.textContent = 'View regular bin guidelines';
    } else {
      regularBinNotice.classList.add('hidden');
      btnFindDropoffs.textContent = 'Find drop-off near me';
    }

    // 6. Impact counter increment
    if (data.category === 'battery' || data.category === 'hazardous' || data.category === 'ewaste' || filter !== 'none') {
      incrementImpact();
      saveToHistory(data);
    }
  }

  // ==========================================================================
  // Geolocation & Drop-offs
  // ==========================================================================
  async function loadDropoffPoints() {
    placesLoadingIndicator.classList.remove('hidden');
    placesEmptyState.classList.add('hidden');
    placesCardsList.innerHTML = '';

    // Step 1: Geolocation
    if (!cachedUserLocation) {
      try {
        gpsAreaLabel.textContent = 'Acquiring GPS location...';
        cachedUserLocation = await fetchBrowserCoordinates();
        gpsAreaLabel.textContent = 'GPS on: [Your current location]';
      } catch (geoErr) {
        console.warn('Geolocation denied or timed out:', geoErr);
        cachedUserLocation = null;
        gpsAreaLabel.textContent = 'GPS off: USF / Tampa area';
      }
    }

    // Step 2: Fetch /api/dropoffs
    try {
      const filter = activeFilterType || 'batteries';
      const dropoffs = await requestDropoffsAPI(cachedUserLocation, filter);
      activeDropoffs = dropoffs;
      placesLoadingIndicator.classList.add('hidden');

      renderPlacesList();

      // Step 3: Draw map via Person B's Watt2DoMap
      renderMapModule(cachedUserLocation, activeDropoffs);
    } catch (err) {
      console.error('Failed to retrieve drop-offs:', err);
      placesLoadingIndicator.classList.add('hidden');
      placesEmptyState.classList.remove('hidden');
      renderMapModule(cachedUserLocation, []);
    }
  }

  function fetchBrowserCoordinates() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    });
  }

  async function requestDropoffsAPI(location, filter) {
    const params = new URLSearchParams();
    params.set('filter', filter);

    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      params.set('lat', location.lat);
      params.set('lng', location.lng);
    } else {
      params.set('lat', DEFAULT_COORDS.lat);
      params.set('lng', DEFAULT_COORDS.lng);
    }

    const res = await fetch(`/api/dropoffs?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Drop-off service responded with ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to load locations');
    }

    return Array.isArray(data.results) ? data.results : [];
  }

  function renderPlacesList() {
    placesCardsList.innerHTML = '';

    let items = activeDropoffs;
    if (filterOnlyOpen) {
      items = items.filter((item) => item.openNow !== false);
    }

    if (items.length === 0) {
      placesEmptyState.classList.remove('hidden');
      return;
    }
    placesEmptyState.classList.add('hidden');

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'place-card-item';

      const numCircle = document.createElement('span');
      numCircle.className = 'place-num-circle';
      numCircle.textContent = (index + 1).toString();

      const infoCol = document.createElement('div');
      infoCol.className = 'place-info-col';

      const title = document.createElement('h4');
      title.className = 'place-title';
      title.textContent = item.name || 'Drop-off Location';

      const meta = document.createElement('p');
      meta.className = 'place-meta-line';

      const distance = typeof item.distanceKm === 'number' ? `${item.distanceKm.toFixed(1)} km` : '';
      let statusStr = '';
      if (item.openNow === true) {
        statusStr = '<span class="open-now-text">Open now</span>';
      } else if (item.hours) {
        statusStr = item.hours;
      } else if (item.openNow === false) {
        statusStr = 'Closed';
      }

      meta.innerHTML = distance && statusStr ? `${distance} &bull; ${statusStr}` : distance || statusStr;

      infoCol.appendChild(title);
      infoCol.appendChild(meta);
      li.appendChild(numCircle);
      li.appendChild(infoCol);

      li.addEventListener('click', () => {
        document.querySelectorAll('.place-card-item').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
      });

      placesCardsList.appendChild(li);
    });
  }

  function renderMapModule(location, results) {
    if (window.Watt2DoMap && typeof window.Watt2DoMap.show === 'function') {
      try {
        window.Watt2DoMap.show('map', location, results);
      } catch (err) {
        console.warn('Watt2DoMap.show threw an exception:', err);
      }
    } else {
      console.info('Watt2DoMap is loading or not yet initialized.');
    }
  }

  // ==========================================================================
  // Gamified Impact Tracking & LocalStorage
  // ==========================================================================
  function getImpactCount() {
    try {
      const val = localStorage.getItem(STORAGE_KEY_IMPACT);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  function incrementImpact() {
    try {
      const next = getImpactCount() + 1;
      localStorage.setItem(STORAGE_KEY_IMPACT, next.toString());
      updateImpactMetrics();
      return next;
    } catch (e) {
      return getImpactCount();
    }
  }

  function updateImpactMetrics() {
    const count = getImpactCount();
    if (homeImpactCount) homeImpactCount.textContent = count.toString();
    if (impactBigNumber) impactBigNumber.textContent = count.toString();

    // Battery Gauge blocks logic (Level 1..5)
    // Level formula: Level = Math.floor(count / 5) + 1
    // Gauge fills 1 to 5 blocks
    const level = Math.floor(count / 5) + 1;
    const progressInLevel = count % 5;
    const neededForNext = 5 - progressInLevel;

    if (batteryLevelSubtitle) {
      batteryLevelSubtitle.textContent = `Level ${level} \u2022 ${neededForNext} more scan${neededForNext === 1 ? '' : 's'} to Level ${level + 1}`;
    }

    const blocksToFill = progressInLevel === 0 && count > 0 ? 5 : progressInLevel;
    for (let i = 1; i <= 5; i++) {
      const blockEl = document.getElementById(`gb-${i}`);
      if (blockEl) {
        blockEl.classList.toggle('filled', i <= blocksToFill);
      }
    }

    // Milestones
    if (milestoneFirst) milestoneFirst.classList.toggle('unlocked', count >= 1);
    if (milestone5) milestone5.classList.toggle('unlocked', count >= 5);
    if (milestone10) milestone10.classList.toggle('unlocked', count >= 10);
  }

  function updateProfileMetrics() {
    const count = getImpactCount();
    if (profileItemsCount) profileItemsCount.textContent = count.toString();

    const level = Math.floor(count / 5) + 1;
    const progressInLevel = count % 5;
    const neededForNext = 5 - progressInLevel;

    if (profileLevelVal) profileLevelVal.textContent = `Lv ${level}`;
    if (profileNextScanDesc) profileNextScanDesc.textContent = `${neededForNext} more scan${neededForNext === 1 ? '' : 's'} to Lv ${level + 1}`;
  }

  function saveToHistory(item) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
      existing.unshift({
        item: item.item,
        batteryType: item.batteryType,
        date: new Date().toLocaleDateString(),
      });
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(existing.slice(0, 10)));
    } catch (e) {
      /* ignore */
    }
  }

  // ==========================================================================
  // Watty AI Helper Chat (Gemini Assistant Stretch Feature)
  // ==========================================================================
  function handleWattySubmit() {
    const text = wattyInput.value.trim();
    if (!text) return;
    wattyInput.value = '';
    sendWattyMessage(text);
  }

  function sendWattyMessage(text) {
    // Append User Bubble
    appendChatBubble(text, 'watty-user');

    // Simulate smart thinking indicator
    const thinkingBubble = appendChatBubble('Thinking...', 'watty-bot');

    setTimeout(() => {
      const answer = generateWattyResponse(text);
      thinkingBubble.textContent = answer;
      wattyMessagesContainer.scrollTop = wattyMessagesContainer.scrollHeight;
    }, 450);
  }

  function appendChatBubble(text, className) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${className}`;
    bubble.textContent = text;
    wattyMessagesContainer.appendChild(bubble);
    wattyMessagesContainer.scrollTop = wattyMessagesContainer.scrollHeight;
    return bubble;
  }

  function generateWattyResponse(query) {
    const q = query.toLowerCase();

    if (q.includes('swollen') || q.includes('heat') || q.includes('fire') || q.includes('safe to store')) {
      return 'Tape the terminals, keep it away from heat and combustibles, and store it in a non-flammable container like a metal tin or bucket of sand. Never recharge or puncture it!';
    }
    if (q.includes('drop-off') || q.includes('where') || q.includes('take') || q.includes('near')) {
      return 'You can drop them off at certified retail bins like Best Buy, Home Depot, Batteries Plus, or Hillsborough County hazardous waste facilities. Tap "Find drop-off near me" on your scan to see driving directions!';
    }
    if (q.includes('tape') || q.includes('terminal')) {
      return 'Use non-conductive electrical tape or clear packing tape directly over the positive and negative ends. This stops accidental short circuits and sparks in transit!';
    }
    if (q.includes('alkaline') || q.includes('trash') || q.includes('bin')) {
      return 'While single-use alkaline batteries are legally allowed in some municipal garbage, taking them to a recycling drop-off recovers valuable zinc and steel and prevents landfill leaching.';
    }

    return "I'm Watty! Keep dead batteries away from regular trash to prevent truck fires. Always tape exposed terminals and use our map to locate a certified drop-off!";
  }

  // ==========================================================================
  // Feedback & Utilities
  // ==========================================================================
  function setLoadingText(msg) {
    if (loadingSubMessage) {
      loadingSubMessage.textContent = msg;
    }
  }

  function showError(msg) {
    if (errorToast && errorToastText) {
      errorToastText.textContent = msg;
      errorToast.classList.remove('hidden');
    }
  }

  function dismissError() {
    if (errorToast) {
      errorToast.classList.add('hidden');
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
