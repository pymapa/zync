import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import polyline from 'polyline-encoded';
import type { DetailedActivity } from '../../types';

interface ActivityMapProps {
  readonly activity: DetailedActivity;
  readonly height?: number;
}

export function ActivityMap({ activity, height = 350 }: ActivityMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !activity.map?.summaryPolyline) return;

    // Decode polyline to coordinates
    const coordinates = polyline.decode(activity.map.summaryPolyline);

    if (coordinates.length === 0) return;

    // Initialize map if not already created
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing layers (except tile layer)
    map.eachLayer(layer => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Convert coordinates to Leaflet format [lat, lng]
    const latLngs: L.LatLngExpression[] = coordinates.map(([lat, lng]) => [lat, lng]);

    // Draw route
    const routeLine = L.polyline(latLngs, {
      color: '#EF4444',
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    // Add start marker
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: '<div style="background: #10B981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    L.marker(latLngs[0], { icon: startIcon }).addTo(map);

    // Add end marker
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: '<div style="background: #EF4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(map);

    // Fit bounds with padding
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activity.map?.summaryPolyline]);

  if (!activity.map?.summaryPolyline) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border shadow-xl" style={{ animation: 'fadeIn 0.6s ease-out' }}>
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-base/40 via-transparent to-transparent pointer-events-none z-10" />

      <div ref={mapRef} className="w-full" style={{ height: `${height}px` }} />

      {/* Map label */}
      <div className="absolute bottom-4 left-4 z-20 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border/50">
        <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Route Map</div>
      </div>
    </div>
  );
}
