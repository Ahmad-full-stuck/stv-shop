import type { Env } from './types'

const DEFAULT_PIN = '2468'
export const SESSION_TTL_MS = 45 * 24 * 60 * 60 * 1000
const PBKDF2_ITERATIONS = 100_000

export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'StvShop2026'

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`
}

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  if (!password || !stored) return false
  const parts = stored.split('$')
  if (parts.length === 4 && parts[0] === 'pbkdf2') {
    try {
      const iterations = Number(parts[1])
      if (!Number.isFinite(iterations) || iterations < 1000) return false
      const salt = hexToBytes(parts[2])
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        key,
        256,
      )
      return bytesToHex(new Uint8Array(bits)) === parts[3]
    } catch {
      return false
    }
  }
  if (stored.startsWith('sha256:')) return (await sha256(password)) === stored.slice('sha256:'.length)
  return password === stored
}

export const verifyPin = async (env: Env, pin: string): Promise<boolean> => {
  if (!pin) return false
  if (env.ADMIN_PIN) return pin === env.ADMIN_PIN
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_pin'").first<{ value: string }>()
  if (!row?.value) return pin === DEFAULT_PIN
  if (row.value.startsWith('sha256:')) {
    const hash = await sha256(pin)
    return hash === row.value.slice('sha256:'.length)
  }
  return pin === row.value
}

export const hashPin = async (pin: string): Promise<string> => `sha256:${await sha256(pin)}`

let schemaReady = false

/** ينشئ جدول المدراء وعمود admin_id في الجلسات عند أول استخدام (بدون مهاجرات يدوية). */
export const ensureAuthSchema = async (env: Env): Promise<void> => {
  if (schemaReady) return
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ).run()
  } catch {
    /* ignore */
  }
  try {
    await env.DB.prepare('ALTER TABLE sessions ADD COLUMN admin_id TEXT').run()
  } catch {
    /* exists */
  }
  try {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first<{ n: number }>()
    if (!count?.n) {
      const hash = await hashPassword(DEFAULT_ADMIN_PASSWORD)
      await env.DB.prepare('INSERT INTO admins (id, username, password_hash, display_name) VALUES (?1, ?2, ?3, ?4)')
        .bind('owner', DEFAULT_ADMIN_USERNAME, hash, 'المدير الرئيسي')
        .run()
    }
  } catch {
    /* ignore */
  }
  schemaReady = true
}

export interface AdminUser {
  id: string
  username: string
}

export const verifyAdminUser = async (env: Env, username: string, password: string): Promise<AdminUser | null> => {
  const clean = username.trim().toLowerCase()
  if (!clean || !password) return null
  await ensureAuthSchema(env)
  const row = await env.DB.prepare('SELECT id, username, password_hash FROM admins WHERE username = ?1')
    .bind(clean)
    .first<{ id: string; username: string; password_hash: string }>()
  if (!row) return null
  const ok = await verifyPassword(password, row.password_hash)
  return ok ? { id: row.id, username: row.username } : null
}

export const createSession = async (env: Env, adminId?: string | null): Promise<string> => {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = Date.now() + SESSION_TTL_MS
  try {
    await env.DB.prepare('INSERT INTO sessions (token, expires_at, admin_id) VALUES (?1, ?2, ?3)')
      .bind(token, expiresAt, adminId ?? null)
      .run()
  } catch {
    await env.DB.prepare('INSERT INTO sessions (token, expires_at) VALUES (?1, ?2)').bind(token, expiresAt).run()
  }
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(Date.now()).run()
  return token
}

export const destroySession = async (env: Env, token: string): Promise<void> => {
  if (!token) return
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run()
}

const staticToken = (): string | null => {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.ADMIN_TOKEN
  return value && value.trim() ? value.trim() : null
}

/** Returns `null` when the caller is authorised, otherwise a ready 401 response. */
export const requireAdmin = async (request: Request, env: Env): Promise<Response | null> => {
  const header = request.headers.get('Authorization') || request.headers.get('X-Admin-Token') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return nullWith('يجب تسجيل الدخول')
  const fallback = staticToken()
  if (fallback && token === fallback) return null
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token = ?1').bind(token).first<{ expires_at: number }>()
  if (!row) return nullWith('انتهت الجلسة، سجّلي الدخول من جديد')
  if (row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run()
    return nullWith('انتهت الجلسة، سجّلي الدخول من جديد')
  }
  try {
    await env.DB.prepare('UPDATE sessions SET expires_at = ?2 WHERE token = ?1').bind(token, Date.now() + SESSION_TTL_MS).run()
  } catch {
    /* ignore */
  }
  return null
}

const nullWith = (message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

const buckets = new Map<string, Map<string, { count: number; resetAt: number }>>()

const hit = (bucket: string, client: string, max: number): boolean => {
  let entries = buckets.get(bucket)
  if (!entries) {
    entries = new Map()
    buckets.set(bucket, entries)
  }
  const now = Date.now()
  const entry = entries.get(client)
  if (!entry || entry.resetAt < now) {
    entries.set(client, { count: 1, resetAt: now + 60_000 })
    return true
  }
  entry.count += 1
  if (entries.size > 5000) entries.clear()
  return entry.count <= max
}

/** Best-effort login throttle (per isolate). 8 attempts per minute per client. */
export const rateLimit = (request: Request): boolean =>
  hit('login', request.headers.get('CF-Connecting-IP') || 'anon', 8)

/** الطلبات: 30 طلباً في الدقيقة لكل عميل (يفصل عن حد تسجيل الدخول). */
export const orderRateLimit = (request: Request): boolean =>
  hit('orders', request.headers.get('CF-Connecting-IP') || 'anon', 30)
