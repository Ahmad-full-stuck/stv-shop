import type { Category, Product, ProductFaq, SiteRoute } from '@/types'
import rawCategories from '../../../../data/categories.json'
import rawProducts from '../../../../data/products.json'
import { sanitizeCategories, sanitizeProducts } from '@/lib/sanitize'

const isHidden = (value: unknown): boolean =>
  Boolean(value) && typeof value === 'object' && (value as { hidden?: unknown }).hidden === true

export const fallbackCategories: Category[] = sanitizeCategories(rawCategories)

export const fallbackProducts: Product[] = sanitizeProducts((rawProducts as unknown[]).filter((item) => !isHidden(item)))

export const fallbackRoutes: SiteRoute[] = [
  { id: 'home', label: 'الرئيسية', path: '/', header: true },
  { id: 'catalog', label: 'المنتجات', path: '/catalog', header: true },
  { id: 'new', label: 'وصل حديثاً', path: '/catalog', header: true },
  { id: 'favorites', label: 'المفضلة', path: '/favorites', header: false },
  { id: 'about', label: 'من نحن', path: '/about', header: true },
  { id: 'guide', label: 'دليل المقاسات', path: '/fabric-guide', header: true },
  { id: 'contact', label: 'تواصلي معنا', path: '/contact', header: false },
  { id: 'tracking', label: 'تتبع الطلب', path: '/order-tracking', header: false },
  { id: 'policies', label: 'السياسات', path: '/policies', header: false },
]

export const governorates = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'الأنبار', 'ديالى',
  'كركوك', 'صلاح الدين', 'واسط', 'بابل', 'ذي قار', 'ميسان', 'المثنى', 'القادسية', 'دهوك', 'السليمانية',
]

export const guideQuestions: ProductFaq[] = [
  { question: 'كيف أختار المقاس المناسب؟', answer: 'قِس صدرك وطولك بالسنتيمتر وقارنها بجدول المقاسات في صفحة المنتج. إذا كنت بين مقاسين اختر الأكبر لراحة أكبر — الجيرزي يتوسّع قليلاً مع الجسم.' },
  { question: 'ما الفرق بين الجيرزي والدرستس؟', answer: 'الجيرزي خفيف ونفّاس ومثالي للتمارين اليومية واللعب. الدرستس أثقل ومقاوم للبرد ومناسب للخروج والتمارين في الطقس البارد. كلاهما قابل للقطعة مع اختيار المقاس.' },
  { question: 'هل المقاسات عراقية أم عالمية؟', answer: 'المقاسات عالمية (S, M, L, XL, XXL) والحذاء بالأرقام الأوروبية (39–45). راجعي جدول المقاس في كل منتج — وأرسل لنا مقاساتك عبر واتساب إذا احترت.' },
  { question: 'كم تبلغ رسوم التوصيل؟', answer: 'التوصيل ٥ آلاف دينار لكل محافظات العراق، والدفع عند الاستلام. الطلبات فوق ٥٠ ألف دينار توصيل مجاني.' },
  { question: 'هل يمكنني الاستبدال إذا لم يناسبني المقاس؟', answer: 'نعم — خلال ٣ أيام من الاستلام وبحالة القطعة أصلية وغير مستعملة. تواصل معنا عبر واتساب 07701871844 لترتيب الاستبدال.' },
  { question: 'كيف أعتني بالدرستس والجيرزي؟', answer: 'غسيل بارد أو يدوي مع تجنب المجفف. اقلب القطعة قبل الغسيل وتجنّب المبيض. الحذاء ينظف بإسفنجة مبللة فقط.' },
]

export const trustItems = [
  { title: 'توصيل لكل العراق', description: 'جميع المحافظات', icon: 'truck' },
  { title: 'توصيل ٥ آلاف دينار', description: 'رسوم ثابتة', icon: 'wallet' },
  { title: 'خدمة ما بعد البيع', description: 'استبدال المقاس سهل', icon: 'message' },
  { title: 'ثقة تدريست', description: 'جودة مضمونة', icon: 'check' },
] as const

export const homeStory = {
  title: 'معدات تثق بها — وخدمة تليق بك',
  text: 'STV Shop من كركوك: تشكيلة تجهيزات رياضية مختارة بعناية، من الجيرزي للأحذية والمعدات، مع توصيل لكل العراق وخدمة ما بعد البيع التي تثق بها.',
}

export interface QuickGuideAnswer {
  question: string
  answers: string[]
}

export const quickGuideAnswers: QuickGuideAnswer[] = [
  {
    question: 'كيف أختار مقاس الجيرزي؟',
    answers: [
      'قِس صدرك بالسنتيمتر وقارنها بجدول المقاسات في صفحة المنتج.',
      'إذا كنت بين مقاسين (مثلاً M وL) اختر الأكبر — الجيرزي يتوسّع قليلاً.',
      'أرسل لنا مقاساتك عبر واتساب 07701871844 ونساعدك تختار.',
    ],
  },
  {
    question: 'ما الفرق بين الجيرزي والدرستس؟',
    answers: [
      'الجيرزي خفيف ونفّاس — أنسب للتمارين واللعب.',
      'الدرستس أثقل ومقاوم للبرد — أنسب للخروج والطقس البارد.',
      'كلاهما متوفر بمقاسات S إلى XXL وألوان متعددة.',
    ],
  },
  {
    question: 'هل المقاسات عراقية أم عالمية؟',
    answers: [
      'المقاسات عالمية: S, M, L, XL, XXL.',
      'الحذاء بالأرقام الأوروبية من 39 إلى 45.',
      'جدول المقاس موجود في صفحة كل منتج — راجعه قبل الطلب.',
    ],
  },
  {
    question: 'كم تبلغ رسوم التوصيل؟',
    answers: [
      'التوصيل ٥ آلاف دينار لكل محافظات العراق.',
      'الدفع عند الاستلام — لا حاجة لبطاقة بنكية.',
      'الطلبات فوق ٥٠ ألف دينار توصيل مجاني.',
    ],
  },
  {
    question: 'هل يمكنني الاستبدال إذا لم يناسبني المقاس؟',
    answers: [
      'نعم — خلال ٣ أيام من الاستلام.',
      'القطعة أصلية وغير مستعملة وبعلبتها.',
      'تواصل معنا عبر واتساب 07701871844 لترتيب الاستبدال.',
    ],
  },
  {
    question: 'كيف أعتني بالدرستس والجيرزي؟',
    answers: [
      'غسيل بارد أو يدوي مع تجنب المجفف.',
      'اقلب القطعة قبل الغسيل وتجنّب المبيض.',
      'الحذاء ينظف بإسفنجة مبللة فقط — لا غسالة.',
    ],
  },
]
