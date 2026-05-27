'use client'

import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { SegmentMapPoint } from './SegmentMap'

type SegmentMapProps = {
  points: SegmentMapPoint[]
  center?: { lat: number; lng: number } | null
  radiusMiles?: number | null
  onPickCenter?: (lat: number, lng: number) => void
  className?: string
}

function FitToPoints({
  points,
  center,
}: {
  points: SegmentMapPoint[]
  center?: { lat: number; lng: number } | null
}) {
  const map = useMap()

  const coords = useMemo(() => {
    const values: [number, number][] = points.map((p) => [p.lat, p.lng])
    if (center) values.push([center.lat, center.lng])
    return values
  }, [points, center])

  useEffect(() => {
    if (coords.length === 0) return
    if (coords.length === 1) {
      map.setView(coords[0], 11)
      return
    }
    map.fitBounds(coords, { padding: [24, 24] })
  }, [coords, map])

  return null
}

function MapClickHandler({
  onPickCenter,
}: {
  onPickCenter?: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(event) {
      onPickCenter?.(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

export default function SegmentMapClient({
  points,
  center = null,
  radiusMiles = null,
  onPickCenter,
  className = 'h-72',
}: SegmentMapProps) {
  const initialCenter: [number, number] = center
    ? [center.lat, center.lng]
    : points.length
    ? [points[0].lat, points[0].lng]
    : [39.8283, -98.5795]

  return (
    <div className={`overflow-hidden rounded-xl border border-zinc-200 ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={4}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints points={points} center={center} />
        {onPickCenter ? <MapClickHandler onPickCenter={onPickCenter} /> : null}

        {center ? (
          <>
            <CircleMarker center={[center.lat, center.lng]} radius={8} pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.85 }}>
              <Popup>Starting point</Popup>
            </CircleMarker>
            {radiusMiles && radiusMiles > 0 ? (
              <Circle
                center={[center.lat, center.lng]}
                radius={radiusMiles * 1609.34}
                pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.08 }}
              />
            ) : null}
          </>
        ) : null}

        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={6}
            pathOptions={{
              color: point.color ?? '#2563eb',
              fillColor: point.color ?? '#2563eb',
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <div className="text-sm font-medium text-zinc-900">{point.label}</div>
              {point.sublabel ? <div className="text-xs text-zinc-500 mt-0.5">{point.sublabel}</div> : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
