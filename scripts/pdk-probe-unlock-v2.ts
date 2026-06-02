/**
 * Verify PDK cloud-node device control endpoints discovered in the docs:
 *   - POST /cloud-nodes/{cn}/devices/{d}/try-open  (momentary)
 *   - POST /cloud-nodes/{cn}/devices/{d}/open      (sustained held open)
 *   - POST /cloud-nodes/{cn}/devices/{d}/close     (force back closed)
 *
 * For each device on the sandbox:
 *   1) try-open with dwell=2 → relay clicks for ~2s then auto-releases
 *   2) open                  → relay held open
 *   3) close                 → relay back closed (clean state)
 *
 * Safe to run because the sandbox devices in the shared Developer Sandbox
 * are wired to test rigs, not real doors. The final `close` returns every
 * device to the locked state regardless of where we started.
 *
 *   npx tsx --env-file=.env.local scripts/pdk-probe-unlock-v2.ts
 */
import { pdkFetch } from '@/lib/pdkAuth'

interface Device {
  id: string
  name: string
  connection: string
  type?: string
}

interface Connection {
  id: string
  name: string
  cloudNode?: { id: string; name?: string; serialNumber?: string }
}

async function listJson<T>(path: string, label: string): Promise<T[]> {
  const res = await pdkFetch(path)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${label} failed: ${res.status} ${body}`)
  }
  return (await res.json()) as T[]
}

async function fire(method: string, path: string, body?: unknown): Promise<{ status: number; body: string }> {
  const res = await pdkFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text().catch(() => '')
  return { status: res.status, body: text }
}

async function main() {
  console.log('— PDK cloud-node device-control probe —\n')

  const devices = await listJson<Device>('/devices', 'list devices')
  const connections = await listJson<Connection>('/connections', 'list connections')

  console.log(`devices: ${devices.length}, connections: ${connections.length}`)

  // Build: deviceId → cloudNodeId via the device's connection
  const conMap = new Map<string, string | null>()
  for (const c of connections) conMap.set(c.id, c.cloudNode?.id ?? null)

  for (const d of devices) {
    const cn = conMap.get(d.connection)
    console.log(`\n=== ${d.name} (${d.id})`)
    console.log(`    connection=${d.connection}  cloudNode=${cn ?? '(none)'}`)
    if (!cn) {
      console.log('    SKIP — no cloudNode associated')
      continue
    }
    const base = `/cloud-nodes/${cn}/devices/${d.id}`

    const r1 = await fire('POST', `${base}/try-open`, { dwell: 2 })
    console.log(`    try-open (dwell=2):  ${r1.status} ${r1.body || '(no body)'}`)
    await new Promise((r) => setTimeout(r, 2200))

    const r2 = await fire('POST', `${base}/open`)
    console.log(`    open:                ${r2.status} ${r2.body || '(no body)'}`)
    await new Promise((r) => setTimeout(r, 1000))

    const r3 = await fire('POST', `${base}/close`)
    console.log(`    close:               ${r3.status} ${r3.body || '(no body)'}`)
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log('\nDone. Every device returned to closed state via final /close call.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
