import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Tuscany Village Self Storage — Caryville, TN'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1C0F06',
          backgroundImage: 'linear-gradient(135deg, #1C0F06 0%, #2C1A0E 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 80px',
            border: '2px solid #9E7B3C',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 30,
              color: '#9E7B3C',
              letterSpacing: 8,
              textTransform: 'uppercase',
              marginBottom: 24,
            }}
          >
            Self Storage
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#FAF7F2',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            Tuscany Village
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#B8914A',
              marginTop: 28,
            }}
          >
            Caryville, TN · 24/7 Gate Access · Reserve Online
          </div>
        </div>
      </div>
    ),
    size,
  )
}
