import { describe, expect, it } from 'vitest'
import { calculateDelaySurcharge } from './business'
import { hasValidConsentForPet } from './storage'

describe('calculateDelaySurcharge', () => {
  it('returns 0 when pickup is within 60 minutes', () => {
    expect(calculateDelaySurcharge('10:00', '10:59')).toBe(0)
    expect(calculateDelaySurcharge('10:00', '11:00')).toBe(0)
  })

  it('charges 15€ per started hour over the grace period', () => {
    expect(calculateDelaySurcharge('10:00', '11:01')).toBe(15)
    expect(calculateDelaySurcharge('10:00', '12:00')).toBe(15)
    expect(calculateDelaySurcharge('10:00', '12:01')).toBe(30)
  })
})

describe('hasValidConsentForPet', () => {
  const data = {
    clientes: [
      { id: 'c1', fecha_firma_consentimiento: '2026-07-01T10:00:00.000Z' },
      { id: 'c2', fecha_firma_consentimiento: '', consentimiento_revocado: true },
    ],
    mascotas: [
      { id: 'm1', cliente_id: 'c1' },
      { id: 'm2', cliente_id: 'c2' },
    ],
    visitas: [],
  }

  it('returns true when a pet has a signed, non-revoked consent', () => {
    expect(hasValidConsentForPet(data, 'm1')).toBe(true)
  })

  it('returns false when consent is missing, revoked or pet does not exist', () => {
    expect(hasValidConsentForPet(data, 'm2')).toBe(false)
    expect(hasValidConsentForPet(data, 'missing')).toBe(false)
  })
})
