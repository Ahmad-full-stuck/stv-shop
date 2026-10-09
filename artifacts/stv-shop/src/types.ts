export interface ProductColor {
  id: string
  name: string
  hex: string
  available: boolean
  stock: number
  image?: string
}

export interface ProductSpecs {
  brand: string
  gender: string
  material: string
  sizes: string
  origin: string
  care: string
  use: string
  warranty: string
}

export interface ProductFaq {
  question: string
  answer: string
}

export interface Product {
  id: string
  slug: string
  name: string
  type: string
  categoryId: string
  description: string
  price: number
  compareAtPrice?: number
  image: string
  images: string[]
  video?: string
  colors: ProductColor[]
  colorsEnabled?: boolean
  sizes: string[]
  specs: ProductSpecs
  faqs: ProductFaq[]
  isNew: boolean
  isFeatured: boolean
  stock: number
  createdAt: string
  sourceUrl?: string
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string
  image: string
  accent: string
}

export interface SiteRoute {
  id: string
  label: string
  path: string
  header: boolean
}

export type DataSource = 'api' | 'fallback' | 'mixed'

export interface StorefrontData {
  products: Product[]
  categories: Category[]
  routes: SiteRoute[]
  source: DataSource
}

export interface CartItem {
  product: Product
  color: ProductColor
  size: string
  quantity: number
}

export interface CheckoutForm {
  name: string
  phone: string
  email: string
  governorate: string
  district: string
  address: string
  landmark: string
  notes: string
}

export interface OrderItemPayload {
  productId: string
  productSlug: string
  productName: string
  colorId: string
  color: string
  colorName: string
  size: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface OrderPayload {
  customerName: string
  phone: string
  email?: string
  governorate: string
  district: string
  address: string
  landmark?: string
  notes?: string
  items: OrderItemPayload[]
  subtotal: number
  deliveryFee: number
  total: number
}

export interface CustomerProfile {
  name: string
  phone: string
  governorate: string
  district: string
  address: string
  landmark: string
}
