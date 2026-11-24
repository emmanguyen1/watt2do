/**
 * Watt2DoMap - Google Maps integration module
 * Implements the contract v1.1 frontend map interface.
 */
(function (global) {
  'use strict';

  let mapInstance = null;
  let userMarker = null;
  let resultMarkers = [];
  let currentInfoWindow = null;
  let googleScriptLoadingPromise = null;

  const DEFAULT_CENTER = { lat: 28.06, lng: -82.41 }; // USF Tampa area

  /**
   * Fetch maps configuration from /api/maps-config and load Google Maps JavaScript API.
   */
  function loadGoogleMaps() {
    if (global.google && global.google.maps) {
      return Promise.resolve(global.google.maps);
    }

    if (googleScriptLoadingPromise) {
      return googleScriptLoadingPromise;
    }

    googleScriptLoadingPromise = fetch('/api/maps-config')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch maps config');
        }
        return res.json();
      })
      .then((config) => {
        const key = config && config.mapsKey ? config.mapsKey.trim() : '';
        if (!key) {
          console.warn('Google Maps browser key is empty. Map may fail to load or show developer watermark.');
        }

        return new Promise((resolve, reject) => {
          // If script tag is already present in document
          if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            const checkInterval = setInterval(() => {
              if (global.google && global.google.maps) {
                clearInterval(checkInterval);
                resolve(global.google.maps);
              }
            }, 100);
            return;
          }

          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.async = true;
          script.defer = true;
          const urlKeyParam = key ? `key=${encodeURIComponent(key)}&` : '';
          script.src = `https://maps.googleapis.com/maps/api/js?${urlKeyParam}v=weekly`;

          script.onload = () => {
            if (global.google && global.google.maps) {
              resolve(global.google.maps);
            } else {
              reject(new Error('Google Maps script loaded but google.maps is not available'));
            }
          };

          script.onerror = (err) => {
            console.error('Error loading Google Maps API script:', err);
            reject(new Error('Google Maps API failed to load'));
          };

          document.head.appendChild(script);
        });
      });

    return googleScriptLoadingPromise;
  }

  /**
   * Build HTML content for marker info window.
   */
  function buildInfoWindowContent(item, index) {
    const name = escapeHtml(item.name || 'Drop-off Site');
    const address = escapeHtml(item.address || 'Address not available');
    const dist = typeof item.distanceKm === 'number' ? `${item.distanceKm} km away` : '';
    const openStatus =
      item.openNow === true
        ? '<span style="color:#16a34a; font-weight:600;">● Open now</span>'
        : item.openNow === false
        ? '<span style="color:#dc2626; font-weight:600;">● Closed</span>'
        : '';
    const hours = item.hours ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">${escapeHtml(item.hours)}</div>` : '';

    const acceptsBadges = Array.isArray(item.accepts)
      ? item.accepts
          .map(
            (tag) =>
              `<span style="display:inline-block; background:#e0f2fe; color:#0369a1; font-size:11px; padding:2px 6px; border-radius:4px; margin-right:4px; margin-top:4px;">${escapeHtml(
                tag
              )}</span>`
          )
          .join('')
      : '';

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; max-width:240px; color:#1f2937;">
        <div style="font-size:14px; font-weight:bold; margin-bottom:4px; color:#111827;">${index ? index + '. ' : ''}${name}</div>
        <div style="font-size:12px; color:#4b5563; margin-bottom:4px;">${address}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:12px;">
          ${dist ? `<span style="font-weight:600; color:#0284c7;">${dist}</span>` : '<span></span>'}
          ${openStatus}
        </div>
        ${hours}
        ${acceptsBadges ? `<div style="margin-top:6px;">${acceptsBadges}</div>` : ''}
      </div>
    `;
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

  const Watt2DoMap = {
    /**
     * Show map with user location and nearby drop-off markers.
     * @param {string} containerId - ID of existing HTML div container.
     * @param {{ lat: number, lng: number } | null} userLocation - User's coordinates or null.
     * @param {Array} results - Dropoff results from /api/dropoffs.
     */
    show(containerId, userLocation, results) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Watt2DoMap: Container element with id '${containerId}' not found.`);
        return Promise.reject(new Error(`Container '${containerId}' not found`));
      }

      return loadGoogleMaps()
        .then((maps) => {
          // Clear previous markers and info window
          Watt2DoMap.clear();

          const hasValidUserLocation =
            userLocation &&
            typeof userLocation.lat === 'number' &&
            typeof userLocation.lng === 'number' &&
            !isNaN(userLocation.lat) &&
            !isNaN(userLocation.lng);

          const centerCoords = hasValidUserLocation
            ? { lat: userLocation.lat, lng: userLocation.lng }
            : DEFAULT_CENTER;

          if (!mapInstance || !container.contains(mapInstance.getDiv())) {
            container.innerHTML = '';
            mapInstance = new maps.Map(container, {
              center: centerCoords,
              zoom: 12,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              zoomControl: true,
            });
            currentInfoWindow = new maps.InfoWindow();
          } else {
            mapInstance.setCenter(centerCoords);
          }

          const bounds = new maps.LatLngBounds();

          // 1. Add User marker if available
          if (hasValidUserLocation) {
            const userPos = { lat: userLocation.lat, lng: userLocation.lng };
            userMarker = new maps.Marker({
              position: userPos,
              map: mapInstance,
              title: 'Your Location',
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#2563eb',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              zIndex: 100,
            });

            userMarker.addListener('click', () => {
              if (currentInfoWindow) {
                currentInfoWindow.setContent('<div style="font-weight:600; font-size:13px; padding:4px;">You are here</div>');
                currentInfoWindow.open(mapInstance, userMarker);
              }
            });

            bounds.extend(userPos);
          }

          // 2. Add Result markers
          const validResults = Array.isArray(results) ? results : [];
          validResults.forEach((item, index) => {
            if (typeof item.lat !== 'number' || typeof item.lng !== 'number') {
              return;
            }

            const pos = { lat: item.lat, lng: item.lng };
            const markerNumber = String(index + 1);

            const marker = new maps.Marker({
              position: pos,
              map: mapInstance,
              title: item.name || `Drop-off ${markerNumber}`,
              label: {
                text: markerNumber,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold',
              },
              zIndex: 10 + index,
            });

            marker.addListener('click', () => {
              if (currentInfoWindow) {
                currentInfoWindow.setContent(buildInfoWindowContent(item, markerNumber));
                currentInfoWindow.open(mapInstance, marker);
              }
            });

            resultMarkers.push(marker);
            bounds.extend(pos);
          });

          // 3. Adjust bounds and zoom
          const totalPoints = (hasValidUserLocation ? 1 : 0) + resultMarkers.length;
          if (totalPoints > 1) {
            mapInstance.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
          } else if (totalPoints === 1) {
            mapInstance.setCenter(bounds.getCenter());
            mapInstance.setZoom(13);
          } else {
            // Null user location & empty results
            mapInstance.setCenter(DEFAULT_CENTER);
            mapInstance.setZoom(12);
          }

          return mapInstance;
        })
        .catch((err) => {
          console.warn('Google Maps API not available or no key configured, showing stylized vector map:', err.message || err);
          Watt2DoMap.renderSvgFallback(container, userLocation, results);
        });
    },

    /**
     * Render a stylized vector SVG map (Mockup Page 5 & 18) when Google Maps is offline/unkeyed.
     */
    renderSvgFallback(container, userLocation, results) {
      const items = Array.isArray(results) ? results.slice(0, 5) : [];
      const pinCoords = [
        { x: 110, y: 150 },
        { x: 280, y: 165 },
        { x: 250, y: 220 },
        { x: 80, y: 240 },
        { x: 320, y: 90 },
      ];

      const pinsSvg = items.map((item, idx) => {
        const c = pinCoords[idx] || { x: 150 + idx * 30, y: 150 + idx * 20 };
        const num = idx + 1;
        return `
          <g class="svg-map-pin" id="svg-pin-${idx}" data-idx="${idx}" style="cursor: pointer;">
            <circle cx="${c.x}" cy="${c.y}" r="14" fill="#C6F432" stroke="#161d16" stroke-width="2" />
            <text x="${c.x}" y="${c.y + 4}" fill="#000000" font-size="12" font-family="-apple-system, sans-serif" font-weight="bold" text-anchor="middle">${num}</text>
          </g>
        `;
      }).join('');

      container.innerHTML = `
        <div class="svg-map-fallback-view" aria-label="Interactive drop-offs preview map">
          <svg class="svg-map-svg" viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg">
            <!-- Grid Lines -->
            <defs>
              <pattern id="map-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="currentColor" stroke-width="1" opacity="0.1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />

            <!-- Stylized Road Line -->
            <path d="M 20 180 L 170 145 L 230 160 L 380 200" fill="none" stroke="#3b5038" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
            <path d="M 170 145 L 200 40" fill="none" stroke="#3b5038" stroke-width="4" stroke-linecap="round" opacity="0.5"/>

            <!-- User Location (Blue Dot with Ripple) -->
            <circle cx="200" cy="154" r="16" fill="rgba(37, 99, 235, 0.25)" />
            <circle cx="200" cy="154" r="8" fill="#2563eb" stroke="#ffffff" stroke-width="2.5" />

            <!-- Drop-off Pins -->
            ${pinsSvg}
          </svg>

          <!-- Recenter Button -->
          <button class="map-crosshair-btn" id="btn-recenter-svg-map" aria-label="Center location" title="Center location">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="7"/>
              <line x1="12" y1="1" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="23"/>
              <line x1="1" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="23" y2="12"/>
            </svg>
          </button>
        </div>
      `;

      // Add click events to SVG pins
      items.forEach((item, idx) => {
        const pin = container.querySelector(`#svg-pin-${idx}`);
        if (pin) {
          pin.addEventListener('click', () => {
            Watt2DoMap.selectDropoff(idx);
          });
        }
      });
    },

    /**
     * Clear all markers and reset map state.
     */
    clear() {
      if (userMarker) {
        userMarker.setMap(null);
        userMarker = null;
      }

      resultMarkers.forEach((marker) => {
        if (marker) {
          marker.setMap(null);
        }
      });
      resultMarkers = [];

      if (currentInfoWindow) {
        currentInfoWindow.close();
      }
    },

    /**
     * Trigger info window for a specific drop-off result by index (0-based).
     */
    selectDropoff(index) {
      if (resultMarkers[index] && global.google && global.google.maps && mapInstance) {
        const marker = resultMarkers[index];
        mapInstance.panTo(marker.getPosition());
        mapInstance.setZoom(15);
        global.google.maps.event.trigger(marker, 'click');
      }

      // Highlight SVG pin if fallback map is active
      const allPins = document.querySelectorAll('.svg-map-pin circle, .svg-pin circle');
      allPins.forEach((circle) => {
        circle.setAttribute('fill', 'var(--ac, #C6F432)');
        circle.setAttribute('stroke', 'var(--ol, #161d16)');
        circle.setAttribute('r', '13');
      });

      const activePin = document.querySelector(`#svg-pin-${index} circle`);
      if (activePin) {
        activePin.setAttribute('fill', '#ffffff');
        activePin.setAttribute('stroke', 'var(--ac, #C6F432)');
        activePin.setAttribute('r', '18');
        activePin.setAttribute('stroke-width', '3');
      }
    },
  };

  global.Watt2DoMap = Watt2DoMap;
})(window);
