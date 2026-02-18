/**
 * Terminal World Map — M.A.D.R.E. Global Surveillance Network
 *
 * Uses Leaflet with CartoDB Dark Matter tiles, CSS-filtered to a
 * blue/cyan CRT terminal aesthetic. Supports zoom, pan, custom
 * pulsing markers, connection lines to home base, and tooltips.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Home base: Monterrey, Mexico ──
const HOME_LAT = 25.6695
const HOME_LON = -100.3083

// ── Format number ──
const fmt = (n) => Number(n || 0).toLocaleString()

// ── Unique component ID for scoped styles ──
let _mapId = 0

// ── Custom geographic labels (terminal font, zoom-aware) ──
const GEO_LABELS = [
  // Continents (global view)
  { lat: 50, lon: -105, text: 'NORTH_AMERICA', min: 2, max: 4 },
  { lat: -15, lon: -58, text: 'SOUTH_AMERICA', min: 2, max: 4 },
  { lat: 52, lon: 15, text: 'EUROPE', min: 2, max: 4 },
  { lat: 5, lon: 22, text: 'AFRICA', min: 2, max: 5 },
  { lat: 48, lon: 85, text: 'ASIA', min: 2, max: 4 },
  { lat: -22, lon: 140, text: 'OCEANIA', min: 2, max: 5 },
  // Countries
  { lat: 40, lon: -100, text: 'USA', min: 4, max: 6 },
  { lat: 56, lon: -105, text: 'CANADA', min: 4, max: 6 },
  { lat: 23, lon: -102, text: 'MÉXICO', min: 4, max: 7 },
  { lat: -10, lon: -52, text: 'BRASIL', min: 4, max: 6 },
  { lat: 55, lon: 90, text: 'RUSSIA', min: 3, max: 6 },
  { lat: 35, lon: 105, text: 'CHINA', min: 4, max: 6 },
  { lat: 20, lon: 78, text: 'INDIA', min: 4, max: 6 },
  { lat: 47, lon: 2, text: 'FRANCE', min: 5, max: 7 },
  { lat: 51, lon: 10, text: 'GERMANY', min: 5, max: 7 },
  { lat: 40, lon: -4, text: 'ESPAÑA', min: 5, max: 7 },
  { lat: 54, lon: -2, text: 'UK', min: 5, max: 7 },
  { lat: 36, lon: 139, text: 'JAPAN', min: 4, max: 7 },
  { lat: -25, lon: 134, text: 'AUSTRALIA', min: 4, max: 6 },
  { lat: 5, lon: -74, text: 'COLOMBIA', min: 4, max: 7 },
  { lat: -34, lon: -64, text: 'ARGENTINA', min: 4, max: 6 },
  { lat: 42, lon: 12, text: 'ITALIA', min: 5, max: 7 },
  { lat: 52, lon: 5, text: 'NETHERLANDS', min: 5, max: 7 },
  { lat: 37, lon: 127, text: 'KOREA', min: 5, max: 7 },
  { lat: -1, lon: 37, text: 'KENYA', min: 5, max: 7 },
  { lat: 30, lon: 31, text: 'EGYPT', min: 5, max: 7 },
  { lat: 9, lon: 8, text: 'NIGERIA', min: 5, max: 7 },
  { lat: -33, lon: 22, text: 'SOUTH_AFRICA', min: 4, max: 7 },
  { lat: -5, lon: -78, text: 'PERÚ', min: 4, max: 7 },
  { lat: -33, lon: -71, text: 'CHILE', min: 4, max: 7 },
  // Major cities (zoomed view)
  { lat: 40.71, lon: -74.01, text: 'NEW_YORK', min: 6, max: 11 },
  { lat: 34.05, lon: -118.24, text: 'LOS_ANGELES', min: 6, max: 11 },
  { lat: 41.88, lon: -87.63, text: 'CHICAGO', min: 6, max: 11 },
  { lat: 51.51, lon: -0.13, text: 'LONDON', min: 6, max: 11 },
  { lat: 48.86, lon: 2.35, text: 'PARIS', min: 6, max: 11 },
  { lat: 52.52, lon: 13.41, text: 'BERLIN', min: 6, max: 11 },
  { lat: 35.68, lon: 139.69, text: 'TOKYO', min: 6, max: 11 },
  { lat: 19.43, lon: -99.13, text: 'CDMX', min: 5, max: 11 },
  { lat: 25.67, lon: -100.31, text: 'MONTERREY', min: 5, max: 11 },
  { lat: 20.67, lon: -103.35, text: 'GUADALAJARA', min: 6, max: 11 },
  { lat: 21.16, lon: -86.85, text: 'CANCÚN', min: 6, max: 11 },
  { lat: -23.55, lon: -46.63, text: 'SÃO_PAULO', min: 6, max: 11 },
  { lat: 4.71, lon: -74.07, text: 'BOGOTÁ', min: 6, max: 11 },
  { lat: -34.60, lon: -58.38, text: 'BUENOS_AIRES', min: 6, max: 11 },
  { lat: 40.42, lon: -3.70, text: 'MADRID', min: 6, max: 11 },
  { lat: 41.39, lon: 2.17, text: 'BARCELONA', min: 6, max: 11 },
  { lat: 55.76, lon: 37.62, text: 'MOSCOW', min: 6, max: 11 },
  { lat: 22.32, lon: 114.17, text: 'HONG_KONG', min: 6, max: 11 },
  { lat: 1.35, lon: 103.82, text: 'SINGAPORE', min: 6, max: 11 },
  { lat: 25.20, lon: 55.27, text: 'DUBAI', min: 6, max: 11 },
  { lat: -33.87, lon: 151.21, text: 'SYDNEY', min: 6, max: 11 },
  { lat: 37.57, lon: 126.98, text: 'SEOUL', min: 6, max: 11 },
]

export default function TerminalWorldMap({ points = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const idRef = useRef(`madre-map-${++_mapId}`)

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

    // CartoDB Dark Matter — free, no API key
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // ── Coordinate grid lines (every 30°) ──
    const gridStyle = { color: 'rgba(59, 130, 246, 0.12)', weight: 0.5, interactive: false, dashArray: '3, 6' }
    for (let lat = -60; lat <= 60; lat += 30) {
      L.polyline([[lat, -180], [lat, 180]], { ...gridStyle, weight: lat === 0 ? 0.8 : 0.5, color: lat === 0 ? 'rgba(59, 130, 246, 0.2)' : gridStyle.color }).addTo(map)
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      L.polyline([[-85, lon], [85, lon]], { ...gridStyle, weight: lon === 0 ? 0.8 : 0.5, color: lon === 0 ? 'rgba(59, 130, 246, 0.2)' : gridStyle.color }).addTo(map)
    }

    // ── Terminal-font geographic labels (zoom-aware) ──
    const labelGroup = L.layerGroup().addTo(map)

    const updateLabels = () => {
      const zoom = map.getZoom()
      labelGroup.clearLayers()
      GEO_LABELS.forEach(g => {
        if (zoom >= g.min && zoom <= g.max) {
          const isContinent = g.min <= 3
          const isCity = g.min >= 6
          const icon = L.divIcon({
            className: '',
            html: `<div style="
                            font-family: 'IBM Plex Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
                            font-size: ${isContinent ? '11px' : isCity ? '8px' : '9px'};
                            font-weight: ${isContinent ? '600' : '400'};
                            color: rgba(34, 211, 238, ${isContinent ? '0.45' : isCity ? '0.3' : '0.35'});
                            letter-spacing: ${isContinent ? '4px' : '2px'};
                            text-shadow: 0 0 10px rgba(34, 211, 238, 0.25);
                            white-space: nowrap;
                            pointer-events: none;
                            text-transform: uppercase;
                        ">${g.text}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 6],
          })
          L.marker([g.lat, g.lon], { icon, interactive: false, pane: 'tooltipPane' }).addTo(labelGroup)
        }
      })
    }

    map.on('zoomend', updateLabels)
    updateLabels()

    // Zoom control (bottom right to match terminal aesthetic)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

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
        <div class="madre-home-marker">
          <div class="madre-home-crosshair"></div>
          <div class="madre-home-ring"></div>
          <div class="madre-home-ring madre-home-ring-2"></div>
          <div class="madre-home-dot"></div>
          <div class="madre-home-label">HOME_BASE</div>
        </div>
      `,
      iconSize: [80, 80],
      iconAnchor: [40, 40],
    })

    const homeMarker = L.marker([HOME_LAT, HOME_LON], { icon: homeIcon, zIndexOffset: 1000 })
      .addTo(map)
    homeMarker.bindPopup(`
      <div style="font-family:monospace;font-size:11px;color:#22d3ee;background:rgba(0,8,20,0.95);padding:8px 12px;border:1px solid rgba(34,211,238,0.4);border-radius:4px;box-shadow:0 0 15px rgba(34,211,238,0.2);min-width:160px">
        <div style="font-weight:bold;margin-bottom:4px;letter-spacing:1px">◉ HOME_BASE</div>
        <div style="color:rgba(96,165,250,0.7);font-size:10px">15 de Mayo 1233, Centro, MTY</div>
        <div style="color:rgba(96,165,250,0.4);font-size:9px;margin-top:2px">lat:${HOME_LAT.toFixed(4)} lon:${HOME_LON.toFixed(4)}</div>
      </div>
    `, { className: 'madre-popup' })
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
          color: 'rgba(34, 211, 238, 0.12)',
          weight: 1,
          dashArray: '4, 8',
          interactive: false,
        }
      ).addTo(map)
      layersRef.current.push(line)

      // Visitor dot marker
      const dotIcon = L.divIcon({
        className: '',
        html: `
          <div class="madre-visitor-marker" style="width:${size}px;height:${size}px">
            <div class="madre-visitor-pulse" style="width:${size * 2.5}px;height:${size * 2.5}px;left:${-(size * 0.75)}px;top:${-(size * 0.75)}px"></div>
            <div class="madre-visitor-dot" style="width:${size}px;height:${size}px;opacity:${0.5 + intensity * 0.5}"></div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const marker = L.marker([lat, lon], { icon: dotIcon, zIndexOffset: visits })
        .addTo(map)

      // Rich popup
      const location = [p.city, p.country].filter(Boolean).join(', ') || 'Unknown'
      marker.bindPopup(`
        <div style="font-family:monospace;font-size:11px;color:#60a5fa;background:rgba(0,8,20,0.95);padding:8px 12px;border:1px solid rgba(59,130,246,0.3);border-radius:4px;box-shadow:0 0 15px rgba(59,130,246,0.15);min-width:160px">
          <div style="color:#22d3ee;font-weight:bold;margin-bottom:4px">${location}</div>
          <div style="color:rgba(96,165,250,0.6);font-size:10px">${fmt(visits)} visit${visits > 1 ? 's' : ''}</div>
          <div style="color:rgba(96,165,250,0.3);font-size:9px;margin-top:2px">lat:${lat.toFixed(2)} lon:${lon.toFixed(2)}</div>
        </div>
      `, { className: 'madre-popup' })

      // Hover events for bottom bar
      marker.on('mouseover', () => setHoveredPoint(p))
      marker.on('mouseout', () => setHoveredPoint(null))

      layersRef.current.push(marker)
    })

  }, [points])

  return (
    <div
      className="rounded overflow-hidden relative"
      style={{
        background: 'rgba(0, 8, 20, 0.8)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        boxShadow: '0 0 30px rgba(59, 130, 246, 0.08), inset 0 0 40px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* ── Scoped styles for Leaflet terminal theme ── */}
      <style>{`
        #${idRef.current} .leaflet-tile-pane {
          filter: brightness(1.5) contrast(1.1) saturate(0.5) sepia(0.85) hue-rotate(180deg);
        }
        #${idRef.current} .leaflet-container {
          background: #000814 !important;
          font-family: 'IBM Plex Mono', 'Fira Code', 'Cascadia Code', monospace;
        }
        #${idRef.current} .leaflet-control-zoom a {
          background: rgba(0, 10, 30, 0.85) !important;
          color: #3b82f6 !important;
          border-color: rgba(59, 130, 246, 0.25) !important;
          font-family: monospace !important;
          width: 28px !important;
          height: 28px !important;
          line-height: 28px !important;
          font-size: 14px !important;
        }
        #${idRef.current} .leaflet-control-zoom a:hover {
          background: rgba(59, 130, 246, 0.15) !important;
          color: #22d3ee !important;
        }
        /* Remove default popup styles */
        #${idRef.current} .madre-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
        }
        #${idRef.current} .madre-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        #${idRef.current} .madre-popup .leaflet-popup-tip {
          background: rgba(0, 8, 20, 0.95) !important;
          border: 1px solid rgba(59, 130, 246, 0.3);
          box-shadow: none !important;
        }
        #${idRef.current} .leaflet-popup-close-button {
          color: rgba(59, 130, 246, 0.4) !important;
          font-size: 16px !important;
        }
        #${idRef.current} .leaflet-popup-close-button:hover {
          color: #22d3ee !important;
        }

        /* ── Home base marker ── */
        .madre-home-marker {
          position: relative;
          width: 80px;
          height: 80px;
        }
        .madre-home-crosshair {
          position: absolute;
          left: 50%; top: 50%;
          width: 40px; height: 40px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(34, 211, 238, 0.5);
          border-radius: 0;
        }
        .madre-home-crosshair::before,
        .madre-home-crosshair::after {
          content: '';
          position: absolute;
          background: rgba(34, 211, 238, 0.5);
        }
        .madre-home-crosshair::before {
          left: 50%; top: -8px;
          width: 1px; height: calc(100% + 16px);
          transform: translateX(-50%);
        }
        .madre-home-crosshair::after {
          top: 50%; left: -8px;
          height: 1px; width: calc(100% + 16px);
          transform: translateY(-50%);
        }
        .madre-home-ring {
          position: absolute;
          left: 50%; top: 50%;
          width: 24px; height: 24px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(34, 211, 238, 0.35);
          border-radius: 50%;
          animation: madre-ring-pulse 3s ease-out infinite;
        }
        .madre-home-ring-2 {
          animation-delay: 1.5s;
        }
        .madre-home-dot {
          position: absolute;
          left: 50%; top: 50%;
          width: 8px; height: 8px;
          transform: translate(-50%, -50%);
          background: #22d3ee;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.3);
          animation: madre-dot-breathe 2s ease-in-out infinite;
        }
        .madre-home-label {
          position: absolute;
          left: calc(50% + 26px);
          top: 50%;
          transform: translateY(-50%);
          color: rgba(34, 211, 238, 0.8);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          white-space: nowrap;
          text-shadow: 0 0 6px rgba(34, 211, 238, 0.4);
        }

        /* ── Visitor markers ── */
        .madre-visitor-marker {
          position: relative;
        }
        .madre-visitor-pulse {
          position: absolute;
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: madre-ring-pulse 3s ease-out infinite;
        }
        .madre-visitor-dot {
          position: absolute;
          left: 0; top: 0;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.9) 0%, rgba(59, 130, 246, 0.3) 70%);
          border: 1px solid rgba(96, 165, 250, 0.6);
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
          cursor: pointer;
        }
        .madre-visitor-dot:hover {
          background: radial-gradient(circle, rgba(34, 211, 238, 0.9) 0%, rgba(34, 211, 238, 0.3) 70%);
          border-color: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 16px rgba(34, 211, 238, 0.6);
        }

        /* ── Animations ── */
        @keyframes madre-ring-pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
        @keyframes madre-dot-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
        }
      `}</style>

      {/* ── Terminal header ── */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{
          background: 'rgba(0, 10, 30, 0.8)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.15)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-cyan-400 text-xs admin-terminal-font uppercase tracking-widest">
            &gt; M.A.D.R.E. global_surveillance_network
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs admin-terminal-font">
          <span className="text-blue-600/40">NODES: <span className="text-cyan-400">{points.length}</span></span>
          <span className="text-blue-600/40">STATUS: <span className="text-green-400">ACTIVE</span></span>
        </div>
      </div>

      {/* ── Leaflet Map Container ── */}
      <div id={idRef.current} className="relative">
        {/* CRT scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[1000]"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,255,255,0.006) 3px, rgba(0,255,255,0.006) 6px)',
          }}
        />
        <div
          ref={containerRef}
          style={{ height: '450px', width: '100%' }}
        />
      </div>

      {/* ── Bottom data readout ── */}
      <div
        className="px-4 py-2 flex items-center justify-between text-xs admin-terminal-font"
        style={{
          background: 'rgba(0, 10, 30, 0.6)',
          borderTop: '1px solid rgba(59, 130, 246, 0.1)',
        }}
      >
        <span className="text-blue-600/30">
          {hoveredPoint ? (
            <span className="text-cyan-400/70">
              ● {hoveredPoint.city ? `${hoveredPoint.city}, ` : ''}{hoveredPoint.country} —
              {fmt(hoveredPoint.visits)} visit{parseInt(hoveredPoint.visits) > 1 ? 's' : ''} —
              lat:{parseFloat(hoveredPoint.lat).toFixed(2)} lon:{parseFloat(hoveredPoint.lon).toFixed(2)}
            </span>
          ) : (
            '// click nodes for details — scroll to zoom — drag to pan'
          )}
        </span>
        <span className="text-blue-600/30">
          TILES: CartoDB_Dark • ENGINE: Leaflet
        </span>
      </div>
    </div>
  )
}
