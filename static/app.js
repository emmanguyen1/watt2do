/**
 * Watt2Do — Frontend Application (Person C)
 * Handles:
 *  1. State transitions (Start -> Loading -> Result)
 *  2. Camera capture and client-side photo resizing to 1024px max dimension
 *  3. POST /api/scan and handling contract v1.1 response
 *  4. Low confidence filtering (< 0.6)
 *  5. Geolocation acquisition (with graceful fallback to null)
 *  6. GET /api/dropoffs and rendering drop-offs list
 *  7. Invoking Watt2DoMap.show("map", userLocation, results)
 *  8. LocalStorage impact counter ("N items kept out of landfill")
 *  9. Safe error handling (never expose raw traces to user)
 */

(function () {
  'use strict';

  // --- Constants ---
  const MAX_IMAGE_DIMENSION = 1024;
  const LOW_CONFIDENCE_THRESHOLD = 0.6;
  const IMPACT_STORAGE_KEY = 'watt2do_items_saved';
  const DEFAULT_FALLBACK_COORDS = { lat: 28.06, lng: -82.41 }; // USF Tampa area

  // --- DOM Elements ---
  const stateStart = document.getElementById('state-start');
  const stateLoading = document.getElementById('state-loading');
  const stateResult = document.getElementById('state-result');

  const cameraInput = document.getElementById('camera-input');
  const scanTriggerBtn = document.getElementById('scan-trigger-btn');
  const fileTriggerBtn = document.getElementById('file-trigger-btn');

  const loadingStatusText = document.getElementById('loading-status-text');

  const lowConfidenceBox = document.getElementById('low-confidence-box');
  const confidentResultBox = document.getElementById('confident-result-box');
  const retakeLowConfBtn = document.getElementById('retake-low-conf-btn');
  const scanAnotherBtn = document.getElementById('scan-another-btn');

  const resultItemName = document.getElementById('result-item-name');
  const resultConfidencePill = document.getElementById('result-confidence-pill');
  const resultCategoryBadge = document.getElementById('result-category-badge');
  const resultBatteryTypeBadge = document.getElementById('result-battery-type-badge');

  const damageWarningBanner = document.getElementById('damage-warning-banner');
  const damageNotesText = document.getElementById('damage-notes-text');
  const instructionsList = document.getElementById('instructions-list');

  const regularBinBox = document.getElementById('regular-bin-box');
  const dropoffSection = document.getElementById('dropoff-section');
  const dropoffFilterTag = document.getElementById('dropoff-filter-tag');
  const locationStatusIndicator = document.getElementById('location-status-indicator');
  const dropoffsList = document.getElementById('dropoffs-list');
  const dropoffsLoading = document.getElementById('dropoffs-loading');
  const dropoffsEmpty = document.getElementById('dropoffs-empty');

  const impactCountEl = document.getElementById('impact-count');
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  const errorDismissBtn = document.getElementById('error-dismiss-btn');

  // --- Application State ---
  let isScanning = false;

  // ==========================================================================
  // Initialization & Event Listeners
  // ==========================================================================
  function init() {
    updateImpactDisplay();

    // Trigger file / camera input
    scanTriggerBtn.addEventListener('click', () => {
      clearError();
      cameraInput.click();
    });

    fileTriggerBtn.addEventListener('click', () => {
      clearError();
      cameraInput.click();
    });

    // Handle file chosen / photo captured
    cameraInput.addEventListener('change', handleImageSelection);

    // Retake / Reset buttons
    retakeLowConfBtn.addEventListener('click', resetToStart);
    scanAnotherBtn.addEventListener('click', resetToStart);

    // Dismiss error banner
    errorDismissBtn.addEventListener('click', clearError);
  }

  // ==========================================================================
  // State Transitions
  // ==========================================================================
  function showState(state) {
    stateStart.classList.add('hidden');
    stateLoading.classList.add('hidden');
    stateResult.classList.add('hidden');

    if (state === 'start') {
      stateStart.classList.remove('hidden');
    } else if (state === 'loading') {
      stateLoading.classList.remove('hidden');
    } else if (state === 'result') {
      stateResult.classList.remove('hidden');
    }
  }

  function resetToStart() {
    clearError();
    cameraInput.value = '';
    isScanning = false;

    // Clear map if map module exists
    if (window.Watt2DoMap && typeof window.Watt2DoMap.clear === 'function') {
      try {
        window.Watt2DoMap.clear();
      } catch (e) {
        console.warn('Watt2DoMap.clear error:', e);
      }
    }

    showState('start');
  }

  // ==========================================================================
  // Image Processing (Resize Client-Side to 1024px max dimension)
  // ==========================================================================
  async function handleImageSelection(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file (JPEG or PNG).');
      return;
    }

    try {
      isScanning = true;
      showState('loading');
      setLoadingMessage('Optimizing photo for analysis...');

      const resizedBlob = await resizeImageToMaxDimension(file, MAX_IMAGE_DIMENSION);

      setLoadingMessage('Identifying item & checking battery damage with Gemini...');
      const scanResult = await postScanImage(resizedBlob);

      handleScanSuccess(scanResult);
    } catch (err) {
      console.error('Scan error:', err);
      showError(err.message || 'Unable to scan item. Please try again.');
      resetToStart();
    } finally {
      isScanning = false;
    }
  }

  function resizeImageToMaxDimension(file, maxDimension) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas rendering context not available.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Image compression failed.'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Could not read image file.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  // ==========================================================================
  // API Calls
  // ==========================================================================
  async function postScanImage(blob) {
    const formData = new FormData();
    formData.append('image', blob, 'scan.jpg');

    let response;
    try {
      response = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });
    } catch (networkErr) {
      throw new Error('Network error. Check connection or server status.');
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      throw new Error('Invalid response from server.');
    }

    if (!response.ok || !data.ok) {
      const errMsg = (data && data.error) ? data.error : `Server returned status ${response.status}`;
      throw new Error(errMsg);
    }

    return data;
  }

  // ==========================================================================
  // Scan Result Handling
  // ==========================================================================
  async function handleScanSuccess(result) {
    showState('result');

    const confidence = typeof result.confidence === 'number' ? result.confidence : 1.0;

    // Task 3: Low confidence check (< 0.6)
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidenceBox.classList.remove('hidden');
      confidentResultBox.classList.add('hidden');
      return;
    }

    lowConfidenceBox.classList.add('hidden');
    confidentResultBox.classList.remove('hidden');

    // Populate Item Information
    resultItemName.textContent = result.item || 'Unidentified Item';
    resultConfidencePill.textContent = `${Math.round(confidence * 100)}% match`;

    // Category Badge
    const category = result.category || 'unknown';
    resultCategoryBadge.textContent = category;
    resultCategoryBadge.className = `badge badge-category badge-cat-${category}`;

    // Battery Type Badge
    if (result.batteryType) {
      resultBatteryTypeBadge.textContent = result.batteryType.replace('_', '-');
      resultBatteryTypeBadge.classList.remove('hidden');
    } else {
      resultBatteryTypeBadge.classList.add('hidden');
    }

    // Damage Warning Banner (Task 1: red warning banner when damaged is true)
    if (result.damaged === true) {
      damageWarningBanner.classList.remove('hidden');
      damageNotesText.textContent = result.damageNotes || 'Physical damage or potential swelling detected. Do not charge or incinerate.';
    } else {
      damageWarningBanner.classList.add('hidden');
    }

    // Instructions List (Task 1: render 2 to 5 short strings)
    instructionsList.innerHTML = '';
    const instructions = Array.isArray(result.instructions) ? result.instructions : [];
    if (instructions.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Keep away from fire and water. Follow local e-waste disposal laws.';
      instructionsList.appendChild(li);
    } else {
      instructions.forEach((instr) => {
        const li = document.createElement('li');
        li.textContent = instr;
        instructionsList.appendChild(li);
      });
    }

    // Task 6: Impact Counter in localStorage
    // Increase when a battery or hazardous item is scanned
    if (category === 'battery' || category === 'hazardous' || category === 'ewaste' || result.dropoffFilter === 'batteries' || result.dropoffFilter === 'hazardous' || result.dropoffFilter === 'ewaste') {
      incrementImpactCount();
      updateImpactDisplay();
    }

    // Task 4: Drop-off filter handling
    const filter = result.dropoffFilter || 'none';
    if (filter === 'none') {
      regularBinBox.classList.remove('hidden');
      dropoffSection.classList.add('hidden');
    } else {
      regularBinBox.classList.add('hidden');
      dropoffSection.classList.remove('hidden');
      dropoffFilterTag.textContent = filter;

      await loadDropoffLocations(filter);
    }
  }

  // ==========================================================================
  // Geolocation & Drop-offs
  // ==========================================================================
  async function loadDropoffLocations(filter) {
    locationStatusIndicator.textContent = 'Requesting location...';
    dropoffsLoading.classList.remove('hidden');
    dropoffsEmpty.classList.add('hidden');
    dropoffsList.innerHTML = '';

    // Task 4: Get location with navigator.geolocation (if denied, continue with null)
    let userLocation = null;
    try {
      userLocation = await getUserCoordinates();
      locationStatusIndicator.textContent = 'Using your current location';
    } catch (geoErr) {
      console.warn('Geolocation unavailable or denied:', geoErr);
      userLocation = null;
      locationStatusIndicator.textContent = 'Location denied or unavailable — showing USF / Tampa area drop-offs';
    }

    // Fetch drop-offs from backend
    try {
      const dropoffs = await fetchDropoffs(userLocation, filter);
      dropoffsLoading.classList.add('hidden');

      if (!dropoffs || dropoffs.length === 0) {
        dropoffsEmpty.classList.remove('hidden');
      } else {
        renderDropoffsList(dropoffs);
      }

      // Task 4 & 5: Invoke Watt2DoMap.show("map", userLocation, results)
      renderMap(userLocation, dropoffs || []);
    } catch (dropoffErr) {
      console.error('Failed to load drop-offs:', dropoffErr);
      dropoffsLoading.classList.add('hidden');
      dropoffsEmpty.classList.remove('hidden');
      dropoffsEmpty.querySelector('p').textContent = 'Unable to load drop-off locations right now. Please check local county guidelines.';
      renderMap(userLocation, []);
    }
  }

  function getUserCoordinates() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by browser.'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => reject(err),
        options
      );
    });
  }

  async function fetchDropoffs(userLocation, filter) {
    const params = new URLSearchParams();
    params.set('filter', filter);

    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
      params.set('lat', userLocation.lat);
      params.set('lng', userLocation.lng);
    } else {
      // Fallback coordinates for Places API server call
      params.set('lat', DEFAULT_FALLBACK_COORDS.lat);
      params.set('lng', DEFAULT_FALLBACK_COORDS.lng);
    }

    const response = await fetch(`/api/dropoffs?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Drop-off service responded with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to retrieve drop-offs');
    }

    return Array.isArray(data.results) ? data.results : [];
  }

  function renderDropoffsList(dropoffs) {
    dropoffsList.innerHTML = '';

    dropoffs.forEach((place) => {
      const li = document.createElement('li');
      li.className = 'dropoff-item-card';

      // Top row: Name & Distance
      const topRow = document.createElement('div');
      topRow.className = 'dropoff-item-top';

      const nameEl = document.createElement('h5');
      nameEl.className = 'dropoff-item-name';
      nameEl.textContent = place.name || 'Drop-off Location';
      topRow.appendChild(nameEl);

      if (typeof place.distanceKm === 'number') {
        const distEl = document.createElement('span');
        distEl.className = 'dropoff-item-distance';
        distEl.textContent = `${place.distanceKm.toFixed(1)} km`;
        topRow.appendChild(distEl);
      }
      li.appendChild(topRow);

      // Address
      if (place.address) {
        const addrEl = document.createElement('p');
        addrEl.className = 'dropoff-item-address';
        addrEl.textContent = place.address;
        li.appendChild(addrEl);
      }

      // Details row: OpenNow badge & Accepts tags
      const detailsRow = document.createElement('div');
      detailsRow.className = 'dropoff-item-details';

      if (place.openNow === true) {
        const openBadge = document.createElement('span');
        openBadge.className = 'status-badge status-open';
        openBadge.textContent = 'Open now';
        detailsRow.appendChild(openBadge);
      } else if (place.openNow === false) {
        const closedBadge = document.createElement('span');
        closedBadge.className = 'status-badge status-closed';
        closedBadge.textContent = 'Closed';
        detailsRow.appendChild(closedBadge);
      } else if (place.hours) {
        const hoursBadge = document.createElement('span');
        hoursBadge.className = 'status-badge';
        hoursBadge.textContent = place.hours;
        detailsRow.appendChild(hoursBadge);
      }

      if (Array.isArray(place.accepts)) {
        place.accepts.forEach((mat) => {
          const matTag = document.createElement('span');
          matTag.className = 'accepts-tag';
          matTag.textContent = mat;
          detailsRow.appendChild(matTag);
        });
      }

      li.appendChild(detailsRow);
      dropoffsList.appendChild(li);
    });
  }

  function renderMap(userLocation, results) {
    // Contract v1.1 Frontend Map Interface:
    // Watt2DoMap.show("map", userLocation, results)
    // userLocation = { lat, lng } or null
    // results = array from /api/dropoffs
    if (window.Watt2DoMap && typeof window.Watt2DoMap.show === 'function') {
      try {
        window.Watt2DoMap.show('map', userLocation, results);
      } catch (mapErr) {
        console.warn('Watt2DoMap.show error:', mapErr);
      }
    } else {
      console.info('Watt2DoMap module is not loaded yet or unavailable.');
    }
  }

  // ==========================================================================
  // LocalStorage Impact Counter (Task 6)
  // ==========================================================================
  function getImpactCount() {
    try {
      const val = localStorage.getItem(IMPACT_STORAGE_KEY);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch (e) {
      console.warn('localStorage not accessible:', e);
      return 0;
    }
  }

  function incrementImpactCount() {
    try {
      const current = getImpactCount() + 1;
      localStorage.setItem(IMPACT_STORAGE_KEY, current.toString());
      return current;
    } catch (e) {
      console.warn('localStorage write failed:', e);
      return 0;
    }
  }

  function updateImpactDisplay() {
    const count = getImpactCount();
    if (impactCountEl) {
      impactCountEl.textContent = count.toString();
    }
  }

  // ==========================================================================
  // Helpers & Error Handling (Task 7: Friendly errors, no raw traces)
  // ==========================================================================
  function setLoadingMessage(msg) {
    if (loadingStatusText) {
      loadingStatusText.textContent = msg;
    }
  }

  function showError(msg) {
    if (errorMessage && errorBanner) {
      errorMessage.textContent = msg || 'An error occurred. Please try again.';
      errorBanner.classList.remove('hidden');
    }
  }

  function clearError() {
    if (errorBanner) {
      errorBanner.classList.add('hidden');
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
