import type { Env } from './types'
import { toProduct, type ProductRow, type StoreProduct } from './types'
import { requireAdmin, verifyPin, createSession, destroySession, rateLimit, orderRateLimit, ensureAuthSchema, verifyAdminUser, SESSION_TTL_MS } from './auth'
import { handleAdmin } from './admin'
import { runDiscovery, type DiscoveryInput } from './discover'

const json = (data: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  })

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Max-Age': '86400',
}

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers)
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

const readBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

const listProducts = async (env: Env, includeHidden: boolean): Promise<StoreProduct[]> => {
  const result = await env.DB.prepare(
    `SELECT * FROM products ${includeHidden ? '' : 'WHERE hidden = 0'} ORDER BY sort_order ASC, created_at DESC, name ASC`,
  ).all<ProductRow>()
  return (result.results ?? []).map(toProduct)
}

const publicProduct = (product: StoreProduct): StoreProduct => {
  const clone = { ...product }
  delete clone.hidden
  return clone
}

const orderNumber = (): string =>
  `STV-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`

const fmtDinar = (value: number): string =>
  value >= 1000 && value % 1000 === 0 ? `${value / 1000} الف دينار عراقي` : `${value.toLocaleString('en-US')} دينار عراقي`

const fmtQty = (q: number): string => `${q} قطعة`

interface NotifyOrder {
  number: string
  body: Record<string, unknown>
}

const buildOrderMessage = (order: NotifyOrder): string => {
  const body = order.body
  const nested = (body.customer ?? {}) as Record<string, unknown>
  const str = (key: string): string => String(nested[key] ?? body[key] ?? '').trim()
  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : []
  const totals = (body.totals && typeof body.totals === 'object' ? body.totals : body) as Record<string, unknown>
  const num = (key: string): number => Number(totals[key] ?? 0) || 0
  const lines: string[] = []
  lines.push(`رقم الطلب: ${order.number}`)
  lines.push(`الاسم: ${str('name') || str('customerName')}`)
  lines.push(`الهاتف: ${str('phone')}`)
  if (str('email')) lines.push(`البريد الإلكتروني: ${str('email')}`)
  if (str('governorate')) lines.push(`المحافظة: ${str('governorate')}`)
  if (str('district')) lines.push(`القضاء/المنطقة: ${str('district')}`)
  if (str('address')) lines.push(`العنوان: ${str('address')}`)
  if (str('landmark')) lines.push(`معلم قريب: ${str('landmark')}`)
  if (str('notes')) lines.push(`ملاحظات: ${str('notes')}`)
  lines.push('')
  lines.push('تفاصيل الطلب:')
  for (const item of items) {
    const name = String(item.productName ?? '')
    const color = String(item.colorName ?? '')
    const qty = Number(item.quantity ?? 0) || 0
    const unit = Number(item.unitPrice ?? 0) || 0
    const total = Number(item.totalPrice ?? 0) || 0
    lines.push(`- ${name} (${color}) × ${fmtQty(qty)} × ${fmtDinar(unit)} = ${fmtDinar(total)}`)
  }
  lines.push('')
  lines.push(`المجموع الفرعي: ${fmtDinar(num('subtotal'))}`)
  lines.push(`رسوم التوصيل: ${fmtDinar(num('deliveryFee'))}`)
  lines.push(`الإجمالي: ${fmtDinar(num('total'))}`)
  lines.push(`التاريخ: ${new Date().toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad' })}`)
  return lines.join('\n')
}

const notifyOrderEmail = async (env: Env, order: NotifyOrder): Promise<boolean> => {
  try {
    let content: Record<string, unknown> = {}
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'content'").first<{ value: string }>()
    if (row?.value) {
      try {
        content = JSON.parse(row.value) as Record<string, unknown>
      } catch {
        content = {}
      }
    }
    const provider = String(content.emailProvider ?? 'formsubmit')
    if (provider !== 'formsubmit') {
      console.log(`[notify] order=${order.number} skipped provider=${provider}`)
      return false
    }
    const to = String(content.emailOrdersTo ?? '').trim() || 'wealiahmad.ali@gmail.com'
    const action = String(content.emailFormSubmitAction ?? '').trim() || `https://formsubmit.co/${encodeURIComponent(to)}`
    const subjectTemplate = String(content.emailSubjectOrder ?? 'طلب جديد #{orderNumber}')
    const subject = subjectTemplate.replace('#{orderNumber}', `#${order.number}`).replace('{orderNumber}', order.number)
    const form = new FormData()
    form.append('_subject', subject)
    form.append('_captcha', 'false')
    form.append('_template', 'table')
    form.append('orderNumber', order.number)
    form.append('message', buildOrderMessage(order))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    try {
      const res = await fetch(action, { method: 'POST', body: form, signal: controller.signal })
      const text = await res.text().catch(() => '')
      const pendingActivation = /needs Activation|Activate Form/i.test(text)
      const ok = res.ok && !pendingActivation
      console.log(`[notify] order=${order.number} status=${res.status} activationPending=${pendingActivation}`)
      return ok
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    console.log(`[notify] order=${order.number} failed ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method.toUpperCase()
  const [segment, ...rest] = path.split('/').filter(Boolean)

  if (segment === 'health') {
    const visible = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE hidden = 0').first<{ n: number }>()
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>()
    return json({
      status: 'ok',
      products: visible?.n ?? 0,
      total: total?.n ?? 0,
      storage: 'd1',
      checkedAt: new Date().toISOString(),
    })
  }

  if (segment === 'admin') {
    if (rest[0] === 'login' && method === 'POST') {
      const body = await readBody<{ pin?: string; username?: string; password?: string }>(request)
      if (!rateLimit(request)) return json({ error: 'حاولي لاحقاً' }, 429)
      await ensureAuthSchema(env)
      const username = typeof body?.username === 'string' ? body.username : ''
      const password = typeof body?.password === 'string' ? body.password : ''
      const pin = typeof body?.pin === 'string' ? body.pin : ''
      let adminId: string | null = null
      let valid = false
      if (username && password) {
        const admin = await verifyAdminUser(env, username, password)
        if (admin) {
          valid = true
          adminId = admin.id
        }
      }
      if (!valid && pin) valid = await verifyPin(env, pin)
      if (!valid) return json({ error: 'بيانات الدخول غير صحيحة' }, 401)
      const token = await createSession(env, adminId)
      return json({ data: { token, expiresIn: Math.floor(SESSION_TTL_MS / 1000) } })
    }

    const auth = await requireAdmin(request, env)
    if (auth) return auth

    if (rest[0] === 'logout' && method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      await destroySession(env, token)
      return json({ data: true })
    }
    if (rest[0] === 'whoami') {
      return json({ data: { ok: true } })
    }
    return handleAdmin(request, env, rest, method)
  }

  if (method !== 'GET' && method !== 'POST') return json({ error: 'طريقة غير مدعومة' }, 405)

  if (segment === 'products') {
    const slug = rest[0]
    if (slug) {
      const row = await env.DB.prepare('SELECT * FROM products WHERE slug = ?1 AND hidden = 0').bind(slug).first<ProductRow>()
      if (!row) return json({ error: 'المنتج غير موجود' }, 404)
      return json({ data: publicProduct(toProduct(row)) })
    }
    const products = await listProducts(env, false)
    return json({ data: products.map(publicProduct) })
  }

  if (segment === 'categories') {
    const result = await env.DB.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all()
    return json({ data: result.results ?? [] })
  }

  if (segment === 'routes') {
    const result = await env.DB.prepare('SELECT * FROM routes ORDER BY sort_order ASC').all()
    return json({ data: result.results ?? [] })
  }

  if (segment === 'content') {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'content'").first<{ value: string }>()
    return json({ data: row ? JSON.parse(row.value) : null })
  }

  if (segment === 'settings') {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'store'").first<{ value: string }>()
    const stored = row ? (JSON.parse(row.value) as Record<string, unknown>) : {}
    return json({ data: { colorsEnabled: true, freeDeliveryFrom: 50000, deliveryFee: 5000, ...stored } })
  }

  if (segment === 'contact' && method === 'POST') {
    const body = await readBody<{ name?: unknown; phone?: unknown; message?: unknown }>(request)
    const name = String(body?.name ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const message = String(body?.message ?? '').trim()
    if (name.length < 3 || phone.length < 7 || message.length < 10) return json({ error: 'بيانات الرسالة غير مكتملة' }, 400)
    await env.DB.prepare("INSERT INTO contact_messages (name, phone, message, created_at) VALUES (?1, ?2, ?3, datetime('now'))")
      .bind(name, phone, message)
      .run()
    return json({ data: { saved: true } }, 201)
  }

  if (segment === 'discover' && method === 'POST') {
    const input = await readBody<DiscoveryInput>(request)
    if (!input) return json({ error: 'بيانات غير صالحة' }, 400)
    const products = await listProducts(env, false)
    return json({ data: runDiscovery(products.map(publicProduct), input) })
  }

  if (segment === 'orders') {
    if (method === 'GET') {
      const id = rest[0]
      if (!id) return json({ error: 'رقم الطلب مطلوب' }, 400)
      const row = await env.DB.prepare('SELECT order_number, status, created_at FROM orders WHERE order_number = ?1')
        .bind(id)
        .first()
      if (!row) return json({ error: 'الطلب غير موجود' }, 404)
      return json({ data: row })
    }
    if (method === 'POST') {
      if (!orderRateLimit(request)) return json({ error: 'حاولي إرسال الطلب بعد قليل' }, 429)
      const body = await readBody<Record<string, unknown>>(request)
      if (!body || typeof body !== 'object') return json({ error: 'تعذّر قراءة الطلب' }, 400)
      const items = Array.isArray(body.items) ? body.items : []
      const nested = (body.customer ?? {}) as Record<string, unknown>
      const name = String(nested.name ?? body.customerName ?? '').trim()
      const phone = String(nested.phone ?? body.phone ?? '').trim()
      if (!items.length) return json({ error: 'السلة فارغة' }, 400)
      if (!phone) return json({ error: 'رقم الهاتف مطلوب لتأكيد الطلب' }, 400)
      const customer = { ...nested, name, phone }
      const totals =
        body.totals && typeof body.totals === 'object'
          ? body.totals
          : { subtotal: body.subtotal ?? 0, deliveryFee: body.deliveryFee ?? 0, total: body.total ?? 0 }
      const requested = String(body.orderNumber ?? '').trim()
      const number = requested || orderNumber()
      if (requested) {
        const existing = await env.DB.prepare('SELECT order_number FROM orders WHERE order_number = ?1').bind(number).first()
        if (existing) return json({ data: { orderNumber: number, status: 'new', saved: true } }, 200)
      }
      await env.DB.prepare(
        `INSERT INTO orders (id, order_number, status, customer, items, totals, note, channel, created_at, updated_at)
         VALUES (?1, ?2, 'new', ?3, ?4, ?5, ?6, 'web', datetime('now'), datetime('now'))`,
      )
        .bind(
          number,
          number,
          JSON.stringify(customer),
          JSON.stringify(items),
          JSON.stringify(totals),
          String(body.notes ?? body.note ?? ''),
        )
        .run()
      const notified = await notifyOrderEmail(env, { number, body })
      return json({ data: { orderNumber: number, status: 'new', saved: true, notified } }, 201)
    }
  }

  return json({ error: 'المسار غير موجود' }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204, headers: cors }))

      if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
        const path = url.pathname.slice('/api'.length) || '/'
        const response = await handleApi(request, env, path)
        return withCors(response)
      }

      if (url.pathname.startsWith('/media/')) {
        const key = decodeURIComponent(url.pathname.slice('/media/'.length))
        const row = await env.DB.prepare('SELECT content, type FROM media WHERE key = ?1')
          .bind(key)
          .first<{ content: number[] | ArrayBuffer | null; type: string | null }>()
        if (!row?.content) return new Response('Not found', { status: 404 })
        const raw = row.content
        const bytes = Array.isArray(raw) ? new Uint8Array(raw) : new Uint8Array(raw)
        const headers = new Headers()
        headers.set('Content-Type', row.type || 'image/jpeg')
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')
        return new Response(bytes, { headers })
      }

      return new Response('STV SHOP API', { status: 404 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطأ غير متوقع'
      return withCors(json({ error: message }, 500))
    }
  },
} satisfies ExportedHandler<Env>
