'use client'

import dynamic from 'next/dynamic'

export type SegmentMapPoint = {
  id: string
  label: string
  sublabel?: string
  lat: number
  lng: number
  color?: string
}

type SegmentMapProps = {
  points: SegmentMapPoint[]
  center?: { lat: number; lng: number } | null
  radiusMiles?: number | null
  onPickCenter?: (lat: number, lng: number) => void
  className?: string
}

const SegmentMapClient = dynamic(() => import('./SegmentMapClient'), {
  ssr: false,
})

export default function SegmentMap(props: SegmentMapProps) {
  return <SegmentMapClient {...props} />
}
