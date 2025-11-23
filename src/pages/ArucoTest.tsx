import { useEffect, useRef, useState } from "react"
import { AR } from 'js-aruco2';

type Marker = {
  id: number
  corners: { x: number; y: number }[]
}

type Props = {
  onMarkers?: (markers: Marker[]) => void
}

export function ArucoWebcam({ onMarkers }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const detectorRef = useRef<AR.Detector | null>(null)

  const [ready, setReady] = useState(false)
  const [markers, setMarkers] = useState<Marker[]>([])

  useEffect(() => {
    let stream: MediaStream | null = null
    let rafId: number | null = null

    const setup = async () => {
      detectorRef.current = new AR.Detector({ dictionaryName: "ARUCO_MIP_36h12", maxHammingDistance: 2 })

      stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setReady(true)

      const loop = () => {
        if (!videoRef.current || !canvasRef.current || !detectorRef.current) {
          rafId = requestAnimationFrame(loop)
          return
        }

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          rafId = requestAnimationFrame(loop)
          return
        }

        const w = video.videoWidth || 640
        const h = video.videoHeight || 480
        if (canvas.width !== w) canvas.width = w
        if (canvas.height !== h) canvas.height = h

        ctx.drawImage(video, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const detected: Marker[] = detectorRef.current.detect(imageData) || []

        setMarkers(detected)
        if (onMarkers) onMarkers(detected)

        ctx.lineWidth = 2
        ctx.strokeStyle = "#00ff00"
        ctx.font = "16px sans-serif"
        ctx.fillStyle = "#00ff00"

        detected.forEach((m) => {
          const corners = m.corners
          if (!corners || corners.length === 0) return
          ctx.beginPath()
          ctx.moveTo(corners[0].x, corners[0].y)
          for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x, corners[i].y)
          }
          ctx.closePath()
          ctx.stroke()
          ctx.fillText(String(m.id), corners[0].x, corners[0].y - 5)
        })

        rafId = requestAnimationFrame(loop)
      }

      rafId = requestAnimationFrame(loop)
    }

    setup().catch(console.error)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [onMarkers])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        style={{ width: "100%", maxWidth: 640, border: "1px solid #ccc" }}
      />
      <div style={{ fontSize: 12 }}>
        {ready ? "Webcam running" : "Initializing webcam..."} | Detected markers:{" "}
        {markers.map((m) => m.id).join(", ") || "none"}
      </div>
    </div>
  )
}
