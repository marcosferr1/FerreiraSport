import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Button, Card, CardSection, Input } from '../components/inline/Primitives'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'linear-gradient(135deg, #0B1220 0%, #0B1B3A 45%, #1E1B4B 100%)',
    color: '#E5E7EB',
  }

  const containerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Wrench size={18} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, fontFamily: "'Iceland', sans-serif", letterSpacing: 0.6 }}>
              FERREIRA SPORT
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.75, lineHeight: 1.1 }}>Sistema de gestión</div>
          </div>
        </div>

        <Card
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#E5E7EB',
          }}
        >
          <CardSection style={{ padding: 18 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Iniciar sesión</div>
            </div>

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="email" style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                  Email
                </label>
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="admin@taller.com"
                  autoComplete="email"
                  style={{
                    background: 'rgba(2,6,23,0.35)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#E5E7EB',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="password" style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                  Password
                </label>
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    background: 'rgba(2,6,23,0.35)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#E5E7EB',
                  }}
                />
              </div>

              {error ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    padding: '10px 12px',
                    fontSize: 13,
                    color: '#FCA5A5',
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <Button type="submit" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? 'Ingresando...' : 'Entrar'}
              </Button>
            </form>
          </CardSection>
        </Card>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14, opacity: 0.8 }}>
          Para entrar, usa el usuario administrador configurado en el backend.
        </div>
      </div>
    </div>
  )
}

