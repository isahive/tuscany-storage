import crypto from 'crypto'
import Tenant from '@/models/Tenant'
import VisitorAccess from '@/models/VisitorAccess'

/**
 * Generate a 6-digit PIN that doesn't collide with any in-flight credential.
 *
 * Why 6 digits: PDK supports 4–8; 4 is too small (10k space → ~10% collision
 * after a few hundred holders, plus brute-force trivial at 10k attempts).
 * 6 gives a million-key space which is safer without making the PIN
 * un-memorable for the visitor.
 *
 * Why crypto.randomInt vs Math.random: PINs gate physical access. We don't
 * want a predictable PRNG generating them — OWASP A02:2021.
 *
 * Collision domain:
 *   - tenant.gateCode (tenants share the PDK keypad with visitors)
 *   - VisitorAccess.pin for status='active' (any currently-valid pass)
 *
 * Retries up to 25 times. With 1M keys and a typical small facility (<200
 * active credentials) the loop terminates on the first try ~99.98% of the
 * time; the loop exists to handle the unlikely edge case rather than
 * statistical normalcy.
 */
const PIN_LENGTH = 6
const MAX_ATTEMPTS = 25

export class PinGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinGenerationError'
  }
}

function randomPin(): string {
  // crypto.randomInt(0, 10^6) — uniform across the full range.
  const n = crypto.randomInt(0, 10 ** PIN_LENGTH)
  return String(n).padStart(PIN_LENGTH, '0')
}

export async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const pin = randomPin()
    const [tenantHit, visitorHit] = await Promise.all([
      Tenant.exists({ gateCode: pin }),
      VisitorAccess.exists({ pin, status: 'active' }),
    ])
    if (!tenantHit && !visitorHit) return pin
  }
  throw new PinGenerationError(
    `Could not generate a unique PIN after ${MAX_ATTEMPTS} attempts — keyspace may be saturated.`,
  )
}
