/**
 * Visitor map for the Analytics dashboard (Leaflet + contornos propios).
 *
 * Same visual language as the rest of the CMS (DESIGN.md §15): land in white
 * at low alpha, visitor points in magenta, flat fills and 2px outlines.
 * File name and default export stay as-is so existing imports keep working.
 */

import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { WORLD_LAND } from './worldLand.js'
import { GlobeAltIcon } from '@heroicons/react/24/solid'

// ── Home base: Monterrey, Mexico ──
const HOME_LAT = 25.6695
const HOME_LON = -100.3083

const ACCENT = '#e600ff'

// ── Format number ──
const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

// City/country come from the geo-IP lookup and end up inside Leaflet's
// innerHTML, so they get escaped before interpolation.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

// ── Unique component ID for scoped styles ──
let _mapId = 0

// ── Geographic labels (zoom-aware) ──
const GEO_LABELS = [
  // Continents (global view)
  { lat: 50, lon: -105, text: 'Norteamérica', min: 2, max: 4 },
  { lat: -15, lon: -58, text: 'Sudamérica', min: 2, max: 4 },
  { lat: 52, lon: 15, text: 'Europa', min: 2, max: 4 },
  { lat: 5, lon: 22, text: 'África', min: 2, max: 5 },
  { lat: 48, lon: 85, text: 'Asia', min: 2, max: 4 },
  { lat: -22, lon: 140, text: 'Oceanía', min: 2, max: 5 },
  // Countries
  { lat: 40, lon: -100, text: 'EUA', min: 4, max: 6 },
  { lat: 56, lon: -105, text: 'Canadá', min: 4, max: 6 },
  { lat: 23, lon: -102, text: 'México', min: 4, max: 7 },
  { lat: -10, lon: -52, text: 'Brasil', min: 4, max: 6 },
  { lat: 55, lon: 90, text: 'Rusia', min: 3, max: 6 },
  { lat: 35, lon: 105, text: 'China', min: 4, max: 6 },
  { lat: 20, lon: 78, text: 'India', min: 4, max: 6 },
  { lat: 47, lon: 2, text: 'Francia', min: 5, max: 7 },
  { lat: 51, lon: 10, text: 'Alemania', min: 5, max: 7 },
  { lat: 40, lon: -4, text: 'España', min: 5, max: 7 },
  { lat: 54, lon: -2, text: 'Reino Unido', min: 5, max: 7 },
  { lat: 36, lon: 139, text: 'Japón', min: 4, max: 7 },
  { lat: -25, lon: 134, text: 'Australia', min: 4, max: 6 },
  { lat: 5, lon: -74, text: 'Colombia', min: 4, max: 7 },
  { lat: -34, lon: -64, text: 'Argentina', min: 4, max: 6 },
  { lat: 42, lon: 12, text: 'Italia', min: 5, max: 7 },
  { lat: 52, lon: 5, text: 'Países Bajos', min: 5, max: 7 },
  { lat: 37, lon: 127, text: 'Corea del Sur', min: 5, max: 7 },
  { lat: -1, lon: 37, text: 'Kenia', min: 5, max: 7 },
  { lat: 30, lon: 31, text: 'Egipto', min: 5, max: 7 },
  { lat: 9, lon: 8, text: 'Nigeria', min: 5, max: 7 },
  { lat: -33, lon: 22, text: 'Sudáfrica', min: 4, max: 7 },
  { lat: -5, lon: -78, text: 'Perú', min: 4, max: 7 },
  { lat: -33, lon: -71, text: 'Chile', min: 4, max: 7 },
  // Major cities (zoomed view)
  { lat: 40.71, lon: -74.01, text: 'Nueva York', min: 6, max: 11 },
  { lat: 34.05, lon: -118.24, text: 'Los Ángeles', min: 6, max: 11 },
  { lat: 41.88, lon: -87.63, text: 'Chicago', min: 6, max: 11 },
  { lat: 51.51, lon: -0.13, text: 'Londres', min: 6, max: 11 },
  { lat: 48.86, lon: 2.35, text: 'París', min: 6, max: 11 },
  { lat: 52.52, lon: 13.41, text: 'Berlín', min: 6, max: 11 },
  { lat: 35.68, lon: 139.69, text: 'Tokio', min: 6, max: 11 },
  { lat: 19.43, lon: -99.13, text: 'Ciudad de México', min: 5, max: 11 },
  { lat: 25.67, lon: -100.31, text: 'Monterrey', min: 5, max: 11 },
  { lat: 20.67, lon: -103.35, text: 'Guadalajara', min: 6, max: 11 },
  { lat: 21.16, lon: -86.85, text: 'Cancún', min: 6, max: 11 },
  { lat: -23.55, lon: -46.63, text: 'São Paulo', min: 6, max: 11 },
  { lat: 4.71, lon: -74.07, text: 'Bogotá', min: 6, max: 11 },
  { lat: -34.60, lon: -58.38, text: 'Buenos Aires', min: 6, max: 11 },
  { lat: 40.42, lon: -3.70, text: 'Madrid', min: 6, max: 11 },
  { lat: 41.39, lon: 2.17, text: 'Barcelona', min: 6, max: 11 },
  { lat: 55.76, lon: 37.62, text: 'Moscú', min: 6, max: 11 },
  { lat: 22.32, lon: 114.17, text: 'Hong Kong', min: 6, max: 11 },
  { lat: 1.35, lon: 103.82, text: 'Singapur', min: 6, max: 11 },
  { lat: 25.20, lon: 55.27, text: 'Dubái', min: 6, max: 11 },
  { lat: -33.87, lon: 151.21, text: 'Sídney', min: 6, max: 11 },
  { lat: 37.57, lon: 126.98, text: 'Seúl', min: 6, max: 11 },
]

export default function TerminalWorldMap({ points = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const idRef = useRef(`a-map-${++_mapId}`)

  // ── Initialize Leaflet map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    })

    // Contornos de tierra propios, sin tiles de nadie.
    //
    // Antes esto era un tileLayer de CartoDB con el comentario "free, no API
    // key". Dejó de serlo: el mapa se llenó de marcas de agua "API KEY
    // REQUIRED" en el panel. Un basemap de terceros es una dependencia que
    // puede cambiar de términos, caerse o meter ruido visual sin avisar, y
    // para un mapa de puntos de visita no hace falta.
    //
    // WORLD_LAND es Natural Earth 110m vendorizado (dominio público). Se
    // dibuja como polígonos, así que se tiñe con el tema del CMS y se ve
    // igual sin conexión.
    L.geoJSON(WORLD_LAND, {
      interactive: false,
      // Blanco a alpha bajo sobre --a-bg: el mismo peso visual que tenían los
      // tiles después del filtro de brillo que había aquí (DESIGN.md §15).
      style: {
        color: 'rgba(255, 255, 255, 0.22)',
        weight: 0.7,
        fillColor: '#ffffff',
        fillOpacity: 0.07,
      },
    }).addTo(map)

    // ── Coordinate grid lines (every 30°) ──
    const gridStyle = { color: 'rgba(255, 255, 255, 0.05)', weight: 1, interactive: false, dashArray: '3, 6' }
    const axisColor = 'rgba(255, 255, 255, 0.1)'
    for (let lat = -60; lat <= 60; lat += 30) {
      L.polyline([[lat, -180], [lat, 180]], { ...gridStyle, color: lat === 0 ? axisColor : gridStyle.color }).addTo(map)
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      L.polyline([[-85, lon], [85, lon]], { ...gridStyle, color: lon === 0 ? axisColor : gridStyle.color }).addTo(map)
    }

    // ── Geographic labels (zoom-aware) ──
    const labelGroup = L.layerGroup().addTo(map)

    const updateLabels = () => {
      const zoom = map.getZoom()
      labelGroup.clearLayers()
      GEO_LABELS.forEach(g => {
        if (zoom >= g.min && zoom <= g.max) {
          const kind = g.min <= 3 ? 'continent' : g.min >= 6 ? 'city' : 'country'
          const icon = L.divIcon({
            className: '',
            html: `<div class="wm-label wm-label--${kind}">${g.text}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 6],
          })
          L.marker([g.lat, g.lon], { icon, interactive: false, pane: 'tooltipPane' }).addTo(labelGroup)
        }
      })
    }

    map.on('zoomend', updateLabels)
    updateLabels()

    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)

    // Leaflet trae "Close popup" fijo en el botón de cerrar; no hay opción.
    map.on('popupopen', (e) => {
      e.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Cerrar')
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Update markers when points change ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear previous layers
    layersRef.current.forEach(l => map.removeLayer(l))
    layersRef.current = []

    const maxVisits = Math.max(...points.map(p => parseInt(p.visits) || 1), 1)

    // ── Home Base marker ──
    const homeIcon = L.divIcon({
      className: '',
      html: `
        <div class="wm-home">
          <span class="wm-home__ring"></span>
          <span class="wm-home__dot"></span>
          <span class="wm-home__label">Base</span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    const homeMarker = L.marker([HOME_LAT, HOME_LON], { icon: homeIcon, zIndexOffset: 1000 })
      .addTo(map)
    homeMarker.bindPopup(`
      <div class="wm-popup__title">Base (Monterrey)</div>
      <div class="wm-popup__meta">15 de Mayo 1233, Centro, MTY</div>
      <div class="wm-popup__coords">${HOME_LAT.toFixed(4)}, ${HOME_LON.toFixed(4)}</div>
    `, { className: 'wm-popup' })
    layersRef.current.push(homeMarker)

    // ── Visitor markers + connection lines ──
    points.forEach((p) => {
      const lat = parseFloat(p.lat)
      const lon = parseFloat(p.lon)
      if (!lat && !lon) return

      const visits = parseInt(p.visits) || 1
      const intensity = Math.min(visits / maxVisits, 1)
      const size = 8 + intensity * 16

      // Connection line to home base
      const line = L.polyline(
        [[lat, lon], [HOME_LAT, HOME_LON]],
        {
          color: 'rgba(230, 0, 255, 0.2)',
          weight: 1,
          dashArray: '4, 8',
          interactive: false,
        }
      ).addTo(map)
      layersRef.current.push(line)

      // Visitor dot marker
      const dotIcon = L.divIcon({
        className: '',
        html: `<div class="wm-dot" style="width:${size}px;height:${size}px;opacity:${0.55 + intensity * 0.45}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const marker = L.marker([lat, lon], { icon: dotIcon, zIndexOffset: visits })
        .addTo(map)

      const location = [p.city, p.country].filter(Boolean).join(', ') || 'Ubicación desconocida'
      marker.bindPopup(`
        <div class="wm-popup__title">${esc(location)}</div>
        <div class="wm-popup__meta">${fmt(visits)} ${visits === 1 ? 'visita' : 'visitas'}</div>
        <div class="wm-popup__coords">${lat.toFixed(2)}, ${lon.toFixed(2)}</div>
      `, { className: 'wm-popup' })

      // Hover events for bottom bar
      marker.on('mouseover', () => setHoveredPoint(p))
      marker.on('mouseout', () => setHoveredPoint(null))

      layersRef.current.push(marker)
    })

  }, [points])

  const id = idRef.current
  const hoveredVisits = hoveredPoint ? parseInt(hoveredPoint.visits) || 0 : 0

  return (
    <section className="a-card overflow-hidden">
      {/* Leaflet ships its own chrome (shadows, 1px borders, light fills);
          it's overridden here, scoped to this map's id. */}
      <style>{`
        #${id} .leaflet-container {
          background: var(--a-bg, #0a0510);
          font-family: var(--font-body);
        }

        #${id} .leaflet-bar {
          border: 2px solid var(--a-border, rgba(255, 255, 255, 0.1));
          border-radius: 0.75rem;
          box-shadow: none;
          overflow: hidden;
        }
        #${id} .leaflet-bar a {
          width: 32px;
          height: 32px;
          line-height: 30px;
          font-size: 16px;
          font-weight: 700;
          background: var(--a-surface, #0d0714);
          color: var(--a-text-2, rgba(255, 255, 255, 0.72));
          border-bottom: 2px solid var(--a-border, rgba(255, 255, 255, 0.1));
          border-radius: 0;
        }
        #${id} .leaflet-bar a:last-child { border-bottom: 0; }
        #${id} .leaflet-bar a:focus {
          background: var(--a-surface, #0d0714);
          color: var(--a-text-2, rgba(255, 255, 255, 0.72));
        }
        #${id} .leaflet-bar a:hover {
          background: var(--a-surface-2, #150a1d);
          color: #fff;
        }
        #${id} .leaflet-bar a.leaflet-disabled {
          background: var(--a-surface, #0d0714);
          color: rgba(255, 255, 255, 0.25);
        }
        #${id} .leaflet-bar a:focus-visible {
          outline: 2px solid var(--a-accent, ${ACCENT});
          outline-offset: -2px;
        }

        #${id} .wm-popup .leaflet-popup-content-wrapper {
          background: var(--a-surface-2, #150a1d);
          color: var(--a-text, #fff);
          border: 2px solid var(--a-border-strong, rgba(255, 255, 255, 0.2));
          border-radius: 0.75rem;
          box-shadow: none;
          padding: 0;
        }
        #${id} .wm-popup .leaflet-popup-content {
          margin: 0.625rem 2rem 0.625rem 0.875rem;
          min-width: 150px;
          font-size: 0.8125rem;
          line-height: 1.4;
        }
        #${id} .wm-popup .leaflet-popup-tip {
          background: var(--a-surface-2, #150a1d);
          box-shadow: none;
        }
        #${id} .wm-popup .leaflet-popup-close-button {
          color: var(--a-text-3, rgba(255, 255, 255, 0.48));
          top: 4px;
          right: 4px;
        }
        #${id} .wm-popup .leaflet-popup-close-button:hover,
        #${id} .wm-popup .leaflet-popup-close-button:focus { color: #fff; }
        #${id} .wm-popup__title { font-weight: 700; color: #fff; }
        #${id} .wm-popup__meta { color: var(--a-text-2, rgba(255, 255, 255, 0.72)); margin-top: 2px; }
        #${id} .wm-popup__coords {
          color: var(--a-text-3, rgba(255, 255, 255, 0.48));
          font-size: 0.75rem;
          font-variant-numeric: tabular-nums;
          margin-top: 2px;
        }

        #${id} .wm-label {
          white-space: nowrap;
          pointer-events: none;
          transform: translateX(-50%);
        }
        #${id} .wm-label--continent {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.32);
        }
        #${id} .wm-label--country {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.28);
        }
        #${id} .wm-label--city {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.42);
        }

        #${id} .wm-home {
          position: relative;
          width: 24px;
          height: 24px;
        }
        #${id} .wm-home__ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.5);
        }
        #${id} .wm-home__dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          background: #fff;
        }
        #${id} .wm-home__label {
          position: absolute;
          left: calc(100% + 6px);
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
        }

        /* Dark 2px outline keeps overlapping points readable. */
        #${id} .wm-dot {
          box-sizing: border-box;
          border-radius: 9999px;
          background: var(--a-accent, ${ACCENT});
          border: 2px solid var(--a-bg, #0a0510);
          cursor: pointer;
          transition: transform 160ms var(--a-ease, ease-out);
        }
        #${id} .wm-dot:hover {
          transform: scale(1.3);
          opacity: 1 !important;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 border-b-2 border-white/10">
        <h2 className="a-section-title flex items-center gap-2">
          <GlobeAltIcon className="w-[1.125rem] h-[1.125rem] text-white/50" aria-hidden />
          Mapa de visitas
        </h2>
        <span className="a-meta">
          {fmt(points.length)} {points.length === 1 ? 'ubicación' : 'ubicaciones'}
        </span>
      </div>

      <div id={id} className="relative">
        <div ref={containerRef} className="w-full h-[320px] sm:h-[450px]" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-5 py-3 border-t-2 border-white/10 text-[0.8125rem]">
        {hoveredPoint ? (
          <span className="flex items-center gap-2 min-w-0 text-white/55">
            <span className="a-dot bg-section-quests" aria-hidden />
            <span className="font-semibold text-white truncate">
              {hoveredPoint.city ? `${hoveredPoint.city}, ` : ''}{hoveredPoint.country}
            </span>
            <span className="a-num shrink-0">
              · {fmt(hoveredPoint.visits)} {hoveredVisits === 1 ? 'visita' : 'visitas'} · {parseFloat(hoveredPoint.lat).toFixed(2)}, {parseFloat(hoveredPoint.lon).toFixed(2)}
            </span>
          </span>
        ) : (
          <span className="a-help">Toca o haz clic en un punto para ver el detalle. Acerca con la rueda o pellizcando; arrastra para moverte.</span>
        )}
        <span className="a-meta shrink-0">Natural Earth</span>
      </div>
    </section>
  )
}
