/**
 * Watt2Do — Interactive Application Logic (Person C)
 * Mobile-First Web App for Battery Recognition, Safety Assessment & Drop-off Routing.
 * 
 * Features:
 * - High-speed Canvas downsampling (1024px max) with URL.createObjectURL for memory safety
 * - Full Dark (#0d120e / #C6F432) & Light (#f6f8f2 / #7cb305) mode support (Mockup Pages 2-23)
 * - Gemini Vision API scan integration (Contract v1.1)
 * - Red hazard alert banner for swollen/damaged lithium cells (Thermal Runaway prevention)
 * - Geolocation + Places API drop-offs locator with interactive map sync
 * - Location modal supporting current GPS, Tampa ZIP search (e.g. 33620), and USF default
 * - Gamified impact tracking (Battery progress gauge, levels, milestone badges)
 * - Scan history, saved places, and custom user profiles
 * - Interactive "Watty" conversational helper
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const MAX_IMAGE_DIMENSION = 1024;
  const LOW_CONFIDENCE_THRESHOLD = 0.6;
  const STORAGE_KEY_IMPACT = 'watt2do_items_saved';
  const STORAGE_KEY_HISTORY = 'watt2do_scan_history';
  const STORAGE_KEY_THEME = 'watt2do_theme';
  const STORAGE_KEY_USER = 'watt2do_user_profile';
  const DEFAULT_COORDS = { lat: 28.06, lng: -82.41 }; // USF Tampa area

  // Known Tampa / Hillsborough ZIP coordinates for fast offline resolution
  const TAMPA_ZIPS = {
    '33620': { lat: 28.060, lng: -82.412, name: 'USF Tampa Campus' },
    '33612': { lat: 28.051, lng: -82.447, name: 'North Tampa / Fowler' },
    '33613': { lat: 28.070, lng: -82.442, name: 'University Plaza' },
    '33617': { lat: 28.046, lng: -82.380, name: 'Temple Terrace' },
    '33602': { lat: 27.956, lng: -82.459, name: 'Downtown Tampa' },
    '33607': { lat: 27.969, lng: -82.504, name: 'Midtown / West Tampa' },
    '33618': { lat: 28.043, lng: -82.504, name: 'Carrollwood' },
    '33625': { lat: 28.072, lng: -82.561, name: 'Citrus Park' },
    '33511': { lat: 27.919, lng: -82.291, name: 'Brandon' },
    '33584': { lat: 28.001, lng: -82.285, name: 'Seffner' },
  };

  // --- Screens / Views ---
  const views = {
    scan: document.getElementById('view-scan'),
    loading: document.getElementById('view-loading'),
    result: document.getElementById('view-result'),
    dropoffs: document.getElementById('view-dropoffs'),
    impact: document.getElementById('view-impact'),
    profile: document.getElementById('view-profile'),
  };

  // --- Header & Global Navigation ---
  const brandHomeBtn = document.getElementById('brand-home-btn');
  const headerThemeBtn = document.getElementById('header-theme-btn');
  const headerThemeIcon = document.getElementById('header-theme-icon');
  const headerProfileBtn = document.getElementById('header-profile-btn');
  const tabBtnHome = document.getElementById('tab-btn-home');
  const tabBtnProfile = document.getElementById('tab-btn-profile');

  // Error Toast
  const errorToast = document.getElementById('error-toast');
  const errorToastText = document.getElementById('error-toast-text');
  const errorDismissBtn = document.getElementById('error-dismiss-btn');

  // Hidden File Inputs
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');

  // Screen 1: Scan / Home Elements
  const homeGreetingTitle = document.getElementById('home-greeting-title');
  const homeGreetingDesc = document.getElementById('home-greeting-desc');
  const btnMainScan = document.getElementById('btn-main-scan');
  const btnGalleryUpload = document.getElementById('btn-gallery-upload');
  const btnOpenImpact = document.getElementById('btn-open-impact');
  const homeImpactCount = document.getElementById('home-impact-count');
  const homeRecentScans = document.getElementById('home-recent-scans');
  const homeRecentList = document.getElementById('home-recent-list');
  const btnSeeAllHistory = document.getElementById('btn-see-all-history');

  // Screen 2: Loading Elements
  const loadingSubMessage = document.getElementById('loading-sub-message');

  // Screen 3: Result Elements
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

  // Screen 4: Drop-offs Elements
  const gpsAreaLabel = document.getElementById('gps-area-label');
  const btnUpdateLocation = document.getElementById('btn-update-location');
  const chipOpen = document.getElementById('filter-chip-open');
  const chipBatteries = document.getElementById('filter-chip-batteries');
  const chipEwaste = document.getElementById('filter-chip-ewaste');
  const placesCardsList = document.getElementById('places-cards-list');
  const placesLoadingIndicator = document.getElementById('places-loading-indicator');
  const placesEmptyState = document.getElementById('places-empty-state');
  const btnDropoffsDone = document.getElementById('btn-dropoffs-done');

  // Screen 5: Impact Elements
  const impactBigNumber = document.getElementById('impact-big-number');
  const batteryLevelSubtitle = document.getElementById('battery-level-subtitle');
  const btnImpactScanAnother = document.getElementById('btn-impact-scan-another');
  const milestoneFirst = document.getElementById('ms-first');
  const milestone5 = document.getElementById('ms-5items');
  const milestone10 = document.getElementById('ms-10items');

  // Screen 6: Profile Elements
  const profileDisplayName = document.getElementById('profile-display-name');
  const profileDisplayEmail = document.getElementById('profile-display-email');
  const btnProfileEdit = document.getElementById('btn-profile-edit');
  const profileItemsCount = document.getElementById('profile-items-count');
  const profileLevelVal = document.getElementById('profile-level-val');
  const profileNextScanDesc = document.getElementById('profile-next-scan-desc');
  const btnMenuHistory = document.getElementById('btn-menu-history');
  const btnMenuSaved = document.getElementById('btn-menu-saved');
  const btnMenuSettings = document.getElementById('btn-menu-settings');
  const btnSignOut = document.getElementById('btn-sign-out');

  // Floating Watty Helper
  const wattyTrigger = document.getElementById('watty-floating-trigger');
  const wattyModal = document.getElementById('watty-modal');
  const btnCloseWatty = document.getElementById('btn-close-watty');
  const wattyMessagesContainer = document.getElementById('watty-messages-container');
  const wattyChatForm = document.getElementById('watty-chat-form');
  const wattyInput = document.getElementById('watty-input');
  const quickChips = document.querySelectorAll('.quick-chip');

  // Modals
  const locationModal = document.getElementById('location-modal');
  const btnCloseLocationModal = document.getElementById('btn-close-location-modal');
  const btnLocUseGps = document.getElementById('btn-loc-use-gps');
  const locZipInput = document.getElementById('loc-zip-input');
  const btnLocSubmitZip = document.getElementById('btn-loc-submit-zip');
  const btnLocSkipTampa = document.getElementById('btn-loc-skip-tampa');

  const historyModal = document.getElementById('history-modal');
  const btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
  const historyItemsList = document.getElementById('history-items-list');
  const historyEmpty = document.getElementById('history-empty');

  const savedModal = document.getElementById('saved-modal');
  const btnCloseSavedModal = document.getElementById('btn-close-saved-modal');
  const savedPlacesList = document.getElementById('saved-places-list');

  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const btnClearStorage = document.getElementById('btn-clear-storage');

  const joinModal = document.getElementById('join-modal');
  const btnCloseJoinModal = document.getElementById('btn-close-join-modal');
  const joinAccountForm = document.getElementById('join-account-form');
  const authInputName = document.getElementById('auth-input-name');
  const authInputEmail = document.getElementById('auth-input-email');
  const authTabCreate = document.getElementById('auth-tab-create');
  const authTabSignin = document.getElementById('auth-tab-signin');
  const btnAuthGoogle = document.getElementById('btn-auth-google');
  const btnAuthGuest = document.getElementById('btn-auth-guest');

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
    initTheme();
    initUserProfile();
    updateImpactMetrics();
    renderRecentScansHome();
    setupEventListeners();
  }

  // ==========================================================================
  // Theme Management (Dark & Light Mode)
  // ==========================================================================
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedTheme === 'light') {
      applyTheme('light');
    } else {
      applyTheme('dark');
    }
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      if (headerThemeIcon) headerThemeIcon.textContent = '🌙';
      if (btnToggleTheme) btnToggleTheme.textContent = '☀️ Light Mode';
      localStorage.setItem(STORAGE_KEY_THEME, 'light');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      if (headerThemeIcon) headerThemeIcon.textContent = '☀️';
      if (btnToggleTheme) btnToggleTheme.textContent = '🌙 Dark Mode';
      localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    }
  }

  function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    applyTheme(isLight ? 'dark' : 'light');
  }

  // ==========================================================================
  // User Profile
  // ==========================================================================
  function getUserProfile() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY_USER));
      if (data && data.name) return data;
    } catch (e) { /* ignore */ }
    return { name: 'USF Eco Warrior', email: 'warrior@usf.edu' };
  }

  function saveUserProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
    } catch (e) { /* ignore */ }
    initUserProfile();
  }

  function initUserProfile() {
    const profile = getUserProfile();
    if (profileDisplayName) profileDisplayName.textContent = profile.name;
    if (profileDisplayEmail) profileDisplayEmail.textContent = profile.email;
    if (homeGreetingTitle && profile.name !== 'USF Eco Warrior') {
      homeGreetingTitle.textContent = `Hi, ${profile.name.split(' ')[0]}`;
    }
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
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
      openModal(locationModal);
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

    // Navigation Tabs
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

    headerThemeBtn.addEventListener('click', toggleTheme);

    // Profile Menu Items
    btnMenuHistory.addEventListener('click', () => {
      populateHistoryModal();
      openModal(historyModal);
    });

    btnSeeAllHistory.addEventListener('click', () => {
      populateHistoryModal();
      openModal(historyModal);
    });

    btnMenuSaved.addEventListener('click', () => {
      populateSavedModal();
      openModal(savedModal);
    });

    btnMenuSettings.addEventListener('click', () => {
      openModal(settingsModal);
    });

    btnToggleTheme.addEventListener('click', toggleTheme);

    btnClearStorage.addEventListener('click', () => {
      if (confirm('Reset your impact count and saved scan history?')) {
        localStorage.removeItem(STORAGE_KEY_IMPACT);
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        updateImpactMetrics();
        renderRecentScansHome();
        closeModal(settingsModal);
        showError('Local data has been reset.');
      }
    });

    btnSignOut.addEventListener('click', () => {
      openModal(joinModal);
    });

    btnProfileEdit.addEventListener('click', () => {
      const current = getUserProfile();
      authInputName.value = current.name;
      authInputEmail.value = current.email;
      openModal(joinModal);
    });

    // Auth Form
    authTabCreate.addEventListener('click', () => {
      authTabCreate.classList.add('active');
      authTabSignin.classList.remove('active');
    });

    authTabSignin.addEventListener('click', () => {
      authTabSignin.classList.add('active');
      authTabCreate.classList.remove('active');
    });

    joinAccountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = authInputName.value.trim() || 'USF Eco Warrior';
      const email = authInputEmail.value.trim() || 'warrior@usf.edu';
      saveUserProfile({ name, email });
      closeModal(joinModal);
      showError(`Signed in as ${name}`);
    });

    btnAuthGoogle.addEventListener('click', () => {
      saveUserProfile({ name: 'Google User', email: 'user@gmail.com' });
      closeModal(joinModal);
      showError('Signed in with Google account.');
    });

    btnAuthGuest.addEventListener('click', () => {
      saveUserProfile({ name: 'Guest Explorer', email: 'guest@watt2do.app' });
      closeModal(joinModal);
      showError('Continuing as guest.');
    });

    // Location Modal Actions
    btnLocUseGps.addEventListener('click', async () => {
      closeModal(locationModal);
      cachedUserLocation = null;
      loadDropoffPoints();
    });

    btnLocSubmitZip.addEventListener('click', () => {
      handleZipSubmit();
    });

    locZipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleZipSubmit();
      }
    });

    btnLocSkipTampa.addEventListener('click', () => {
      closeModal(locationModal);
      cachedUserLocation = { ...DEFAULT_COORDS };
      gpsAreaLabel.textContent = 'GPS off: Tampa area';
      loadDropoffPoints();
    });

    // Modal Close Buttons
    btnCloseLocationModal.addEventListener('click', () => closeModal(locationModal));
    btnCloseHistoryModal.addEventListener('click', () => closeModal(historyModal));
    btnCloseSavedModal.addEventListener('click', () => closeModal(savedModal));
    btnCloseSettingsModal.addEventListener('click', () => closeModal(settingsModal));
    btnCloseJoinModal.addEventListener('click', () => closeModal(joinModal));

    [locationModal, historyModal, savedModal, settingsModal, joinModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    // Error Toast Dismiss
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

    // Global keyboard listener (Escape closes modals)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        [locationModal, historyModal, savedModal, settingsModal, joinModal, wattyModal].forEach((m) => {
          if (m) m.classList.add('hidden');
        });
      }
    });
  }

  // ==========================================================================
  // Modal Helpers
  // ==========================================================================
  function openModal(modalEl) {
    if (modalEl) modalEl.classList.remove('hidden');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.add('hidden');
  }

  function handleZipSubmit() {
    const raw = locZipInput.value.trim();
    if (!raw) return;

    closeModal(locationModal);
    const match = TAMPA_ZIPS[raw];
    if (match) {
      cachedUserLocation = { lat: match.lat, lng: match.lng };
      gpsAreaLabel.textContent = `Location: ${match.name}`;
    } else {
      cachedUserLocation = { ...DEFAULT_COORDS };
      gpsAreaLabel.textContent = `Location: Tampa (${raw})`;
    }
    loadDropoffPoints();
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
      renderRecentScansHome();
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
  // Image Capture & Canvas Downsampling (Memory-Safe URL.createObjectURL)
  // ==========================================================================
  async function handleFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Reset input value so re-selecting the same file fires change event
    event.target.value = '';

    if (!file.type.startsWith('image/')) {
      showError('Please select a valid JPEG or PNG image.');
      return;
    }

    try {
      switchScreen('loading');
      setLoadingText('Optimizing image for AI detection...');

      const resizedBlob = await downsampleImageCanvas(file, MAX_IMAGE_DIMENSION);

      setLoadingText('Inspecting damage & chemistry with Gemini Vision...');
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
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
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

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not decode photo from camera'));
      };

      img.src = objectUrl;
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
      throw new Error('Connection error. Please check your network and try again.');
    }

    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      throw new Error('Server returned an unreadable response.');
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

    // Check low confidence threshold (< 0.6)
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
      const note = data.damageNotes ? data.damageNotes.trim() : 'swollen or damaged';
      resDamageDetail.textContent = note.replace(/\.+$/, '');
    } else {
      resDamageBanner.classList.add('hidden');
    }

    // 4. Instructions List
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

    // 6. Impact counter increment & scan history persistence
    if (data.category === 'battery' || data.category === 'hazardous' || data.category === 'ewaste' || filter !== 'none') {
      incrementImpact();
      saveToHistory(data);
      renderRecentScansHome();
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
        cachedUserLocation = { ...DEFAULT_COORDS };
        gpsAreaLabel.textContent = 'GPS off: Tampa / USF area';
      }
    }

    // Step 2: Fetch /api/dropoffs
    try {
      const filter = activeFilterType || 'batteries';
      const dropoffs = await requestDropoffsAPI(cachedUserLocation, filter);
      activeDropoffs = dropoffs;
      placesLoadingIndicator.classList.add('hidden');

      renderPlacesList();

      // Step 3: Draw map via Watt2DoMap
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
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
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
      renderMapModule(cachedUserLocation, []);
      return;
    }
    placesEmptyState.classList.add('hidden');

    // Keep map pins in sync with the filtered list
    renderMapModule(cachedUserLocation, items);

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
        if (window.Watt2DoMap && typeof window.Watt2DoMap.selectDropoff === 'function') {
          window.Watt2DoMap.selectDropoff(index);
        }
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
        item: item.item || 'Battery',
        batteryType: item.batteryType || item.category || 'Recyclable',
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      });
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(existing.slice(0, 15)));
    } catch (e) {
      /* ignore */
    }
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function renderRecentScansHome() {
    if (!homeRecentScans || !homeRecentList) return;
    const items = getHistory();
    if (items.length === 0) {
      homeRecentScans.classList.add('hidden');
      return;
    }

    homeRecentScans.classList.remove('hidden');
    homeRecentList.innerHTML = '';

    items.slice(0, 2).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'recent-scan-pill-item';
      li.innerHTML = `
        <div class="recent-scan-left">
          <span class="recent-item-name">${escapeHtml(item.item)}</span>
          <span class="recent-item-meta">${escapeHtml(item.batteryType)} &bull; ${escapeHtml(item.date)}</span>
        </div>
        <span class="recent-item-chevron">&rsaquo;</span>
      `;
      li.addEventListener('click', () => {
        populateHistoryModal();
        openModal(historyModal);
      });
      homeRecentList.appendChild(li);
    });
  }

  function populateHistoryModal() {
    if (!historyItemsList) return;
    const items = getHistory();
    historyItemsList.innerHTML = '';

    if (items.length === 0) {
      if (historyEmpty) historyEmpty.classList.remove('hidden');
      return;
    }

    if (historyEmpty) historyEmpty.classList.add('hidden');

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-item-left">
          <span class="history-item-title">${escapeHtml(item.item)}</span>
          <span class="history-item-meta">${escapeHtml(item.batteryType)} &bull; Scanned ${escapeHtml(item.date)}</span>
        </div>
        <span class="lime-outline-pill">Safely Diverted</span>
      `;
      historyItemsList.appendChild(li);
    });
  }

  function populateSavedModal() {
    if (!savedPlacesList) return;
    savedPlacesList.innerHTML = `
      <li class="history-item">
        <div class="history-item-left">
          <span class="history-item-title">USF Environmental Health & Safety</span>
          <span class="history-item-meta">4202 E Fowler Ave, Tampa &bull; Accepts batteries & e-waste</span>
        </div>
        <span class="lime-outline-pill">⭐ USF</span>
      </li>
      <li class="history-item">
        <div class="history-item-left">
          <span class="history-item-title">The Home Depot - Fowler</span>
          <span class="history-item-meta">1712 E Fowler Ave, Tampa &bull; Rechargeable battery bin</span>
        </div>
        <span class="subtle-pill">Retail</span>
      </li>
      <li class="history-item">
        <div class="history-item-left">
          <span class="history-item-title">Hillsborough Northwest Solid Waste Facility</span>
          <span class="history-item-meta">8001 W Linebaugh Ave, Tampa &bull; Free county drop-off</span>
        </div>
        <span class="subtle-pill">County</span>
      </li>
    `;
  }

  // ==========================================================================
  // Watty AI Helper Chat (Gemini Assistant)
  // ==========================================================================
  function handleWattySubmit() {
    const text = wattyInput.value.trim();
    if (!text) return;
    wattyInput.value = '';
    sendWattyMessage(text);
  }

  function sendWattyMessage(text) {
    appendChatBubble(text, 'watty-user');

    if (text.toLowerCase().includes('show drop-off') || text.toLowerCase().includes('drop off points')) {
      const botBubble = appendChatBubble('Showing nearest drop-off locations...', 'watty-bot');
      setTimeout(() => {
        wattyModal.classList.add('hidden');
        switchScreen('dropoffs');
        loadDropoffPoints();
      }, 500);
      return;
    }

    const thinkingBubble = appendChatBubble('Thinking...', 'watty-bot');

    setTimeout(() => {
      const answer = generateWattyResponse(text);
      thinkingBubble.textContent = answer;
      wattyMessagesContainer.scrollTop = wattyMessagesContainer.scrollHeight;
    }, 400);
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
      return 'Tape the terminals, keep it away from heat and combustibles, and store it in a non-flammable container like a metal tin or bucket of sand. Never recharge, puncture, or throw it into ordinary household trash!';
    }
    if (q.includes('drop-off') || q.includes('where') || q.includes('take') || q.includes('near')) {
      return 'You can take them to verified locations near USF like Best Buy, Home Depot, Batteries Plus, or Hillsborough County solid waste facilities. Tap "Show drop-off points" to view real-time pins on the map!';
    }
    if (q.includes('tape') || q.includes('terminal')) {
      return 'Use non-conductive electrical tape or clear heavy packaging tape directly over the positive and negative ends. This prevents accidental shorts and sparks in garbage truck compactors!';
    }
    if (q.includes('alkaline') || q.includes('trash') || q.includes('bin')) {
      return 'While standard single-use alkaline batteries can legally go in regular municipal trash in Hillsborough County, taking them to a recycling collection center recovers valuable zinc and steel and prevents landfill leaching.';
    }

    return "I'm Watty! Keep batteries out of regular garbage trucks to prevent catastrophic compactor fires. Always tape terminals, and use our Nearby Drop-offs map to safely recycle them!";
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
