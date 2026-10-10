import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, ExternalLink, ShieldCheck, Crosshair } from 'lucide-react';
import { getGoogleMapsUrl } from '../utils/maps';
import { formatDistanceLabel } from '../utils/geoCoordinates';

// Custom SVG-based Pin Icons to prevent Vite asset URL bundling issues
function createHospitalIcon(isVerified, isSelected) {
  const bgColor = isSelected ? '#ea580c' : isVerified ? '#16a34a' : '#2563eb';
  const size = isSelected ? 38 : 32;

  const svgHtml = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${bgColor};
      color: white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      border: 2px solid white;
      cursor: pointer;
      transition: transform 0.2s ease;
    ">
      <div style="
        transform: rotate(45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? 16 : 14}px;
        font-weight: 800;
      ">
        ${isVerified ? '✓' : '🏥'}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-hospital-marker',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
}

function createUserLocationIcon() {
  const svgHtml = `
    <div style="
      width: 22px;
      height: 22px;
      background: #0284c7;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(2, 132, 199, 0.35), 0 3px 8px rgba(0,0,0,0.3);
      cursor: pointer;
      animation: pulse 2s infinite;
    "></div>
  `;

  return L.divIcon({
    className: 'custom-user-marker',
    html: svgHtml,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

export default function HospitalMap({
  hospitals = [],
  userLocation = null,
  selectedHospitalId = null,
  onSelectHospital = () => {},
  selectedCity = 'Pune',
  height = '520px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const userMarkerRef = useRef(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([18.5204, 73.8567], 12);

      // Free standard OpenStreetMap tiles with high clarity
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Add zoom control top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add minimal attribution bottom-right
      L.control.attribution({ position: 'bottomright', prefix: '© OpenStreetMap' }).addTo(map);

      const markersGroup = L.featureGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when Hospitals or Selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const bounds = L.latLngBounds([]);

    hospitals.forEach((item) => {
      const h = item.hospital || item;
      const coords = item.coordinates || h.coordinates;
      if (!coords || !coords.latitude || !coords.longitude) return;

      const isVerified = item.networkInfo?.networkStatus === 'verified';
      const isSelected = selectedHospitalId === (h.hospital_name || h.name);
      const icon = createHospitalIcon(isVerified, isSelected);

      const marker = L.marker([coords.latitude, coords.longitude], { icon });

      // Build rich popup content
      const score = item.score?.finalScore || 85;
      const distance = item.distanceKm != null ? formatDistanceLabel(item.distanceKm) : null;
      const locality = coords.locality ? ` • ${coords.locality}` : '';

      const gmapsUrl = getGoogleMapsUrl({
        hospital_name: h.hospital_name || h.name,
        address: h.address,
        city: h.city || selectedCity
      });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; min-width: 210px; padding: 4px 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            ${isVerified ? '<span style="background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">✓ Verified Network</span>' : '<span style="background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">Hospital Partner</span>'}
            <span style="margin-left: auto; font-size: 11px; font-weight: 800; color: #0284c7;">Fit: ${score}/100</span>
          </div>
          <strong style="display: block; font-size: 14px; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">
            ${h.hospital_name || h.name}
          </strong>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
            ${distance ? `<span style="color: #0369a1; font-weight: 700;">📍 ${distance}</span>` : ''}
            <span>${locality}</span>
          </div>
          <div style="font-size: 11.5px; color: #475569; margin-bottom: 8px; line-height: 1.35; max-height: 38px; overflow: hidden;">
            ${h.address || selectedCity}
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="
              flex: 1;
              background: #0284c7;
              color: white;
              padding: 5px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              text-align: center;
              text-decoration: none;
              display: inline-block;
            ">🚗 Live Route</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        onSelectHospital(h.hospital_name || h.name);
      });

      marker.addTo(group);
      bounds.extend([coords.latitude, coords.longitude]);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Render User Location if available
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
      const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: createUserLocationIcon(),
        zIndexOffset: 1000
      }).bindPopup(`
        <div style="font-family: inherit; font-size: 12px; text-align: center; padding: 4px;">
          <strong>📍 Your Detected Location</strong>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
            ${userLocation.localityName ? `Near ${userLocation.localityName}` : 'GPS coordinates active'}
          </div>
        </div>
      `);

      userMarker.addTo(map);
      userMarkerRef.current = userMarker;
      bounds.extend([userLocation.latitude, userLocation.longitude]);
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Auto-fit bounds if we have points
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [hospitals, userLocation, selectedHospitalId]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (userLocation && userLocation.latitude) {
      map.flyTo([userLocation.latitude, userLocation.longitude], 14, { duration: 1 });
      if (userMarkerRef.current) userMarkerRef.current.openPopup();
    } else if (markersGroupRef.current) {
      const bounds = markersGroupRef.current.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden', border: '1.5px solid var(--color-border, #e2e8f0)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
      {/* Map DOM Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#f8fafc' }} />

      {/* Floating Map Controls & Badges */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 500, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(6px)',
          border: '1px solid #cbd5e1',
          borderRadius: '20px',
          padding: '5px 12px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#0f172a',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <MapPin size={13} color="#0284c7" />
          <span>{hospitals.length} Hospitals in {selectedCity}</span>
        </div>

        {userLocation && (
          <div style={{
            background: 'rgba(240, 253, 244, 0.95)',
            border: '1px solid #86efac',
            borderRadius: '20px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
            <span>GPS Proximity Active</span>
          </div>
        )}
      </div>

      {/* Recenter Button */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter Map"
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 500,
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
          color: '#0f172a'
        }}
      >
        <Crosshair size={18} />
      </button>

      {/* Legend Footer */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        zIndex: 500,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(4px)',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '11px',
        color: '#475569',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', background: '#16a34a', borderRadius: '50%' }}></span>
          <span>Verified Network</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }}></span>
          <span>Hospital Partner</span>
        </span>
        {userLocation && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: '#0284c7', borderRadius: '50%' }}></span>
            <span>Your GPS</span>
          </span>
        )}
      </div>
    </div>
  );
}
