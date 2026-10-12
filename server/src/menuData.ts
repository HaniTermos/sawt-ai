import { MenuItem, ModifierOption } from './types.js';

export const COMMON_MODIFIERS: Record<string, ModifierOption> = {
  extra_garlic: {
    id: 'extra_garlic',
    name: 'Extra Garlic Sauce',
    nameArabic: 'توم زيادة',
    priceCents: 100, // $1.00
  },
  extra_pickles: {
    id: 'extra_pickles',
    name: 'Extra Pickles',
    nameArabic: 'كبيس زيادة',
    priceCents: 50, // $0.50
  },
  spicy: {
    id: 'spicy',
    name: 'Spicy / Harissa',
    nameArabic: 'حار / حر',
    priceCents: 50, // $0.50
  },
  extra_tahini: {
    id: 'extra_tahini',
    name: 'Extra Tahini',
    nameArabic: 'طحينة زيادة',
    priceCents: 50, // $0.50
  },
  diet_coke: {
    id: 'diet_coke',
    name: 'Diet Coke',
    nameArabic: 'دايت كولا',
    priceCents: 0,
  },
  coke: {
    id: 'coke',
    name: 'Regular Coke',
    nameArabic: 'كولا عادية',
    priceCents: 0,
  },
  sprite: {
    id: 'sprite',
    name: 'Sprite',
    nameArabic: 'سبرايت',
    priceCents: 0,
  },
};

export const BAYTNA_MENU: MenuItem[] = [
  {
    id: 'chicken_shawarma',
    name: 'Chicken Shawarma Wrap',
    nameArabic: 'شاورما دجاج',
    category: 'Wraps',
    description: 'Marinated roasted chicken, toum (garlic sauce), pickles in Lebanese pita',
    descriptionArabic: 'دجاج متبل مع صوص الثوم والكبيس بخبز صاج أو لبناني',
    priceCents: 600, // $6.00
    availableModifiers: [
      COMMON_MODIFIERS.extra_garlic,
      COMMON_MODIFIERS.extra_pickles,
      COMMON_MODIFIERS.spicy,
    ],
  },
  {
    id: 'beef_shawarma',
    name: 'Beef Shawarma Wrap',
    nameArabic: 'شاورما لحمة',
    category: 'Wraps',
    description: 'Spiced flank beef, tarator (tahini sauce), parsley, onions, sumac, tomatoes',
    descriptionArabic: 'لحم بقري متبل مع صوص الطحينة، بقدونس، بصل، سماق وبندورة',
    priceCents: 750, // $7.50
    availableModifiers: [
      COMMON_MODIFIERS.extra_tahini,
      COMMON_MODIFIERS.extra_pickles,
      COMMON_MODIFIERS.spicy,
    ],
  },
  {
    id: 'falafel_wrap',
    name: 'Falafel Wrap',
    nameArabic: 'سندويش فلافل',
    category: 'Wraps',
    description: 'Crispy herb chickpea fritters, tomato, radish, mint, pickled turnip, tahini',
    descriptionArabic: 'أقراص فلافل مقرمشة مع بندورة، فجل، نعناع، كبيس لفت وطحينة',
    priceCents: 500, // $5.00
    availableModifiers: [
      COMMON_MODIFIERS.extra_tahini,
      COMMON_MODIFIERS.extra_pickles,
      COMMON_MODIFIERS.spicy,
    ],
  },
  {
    id: 'hummus',
    name: 'Hummus',
    nameArabic: 'حمص بطحينة',
    category: 'Sides',
    description: 'Silky whipped chickpea dip, tahini, lemon, virgin olive oil, pita bread',
    descriptionArabic: 'حمص ناعم مع طحينة، حامض، زيت زيتون بلدي وخبز لبناني طازج',
    priceCents: 400, // $4.00
    availableModifiers: [
      COMMON_MODIFIERS.spicy,
    ],
  },
  {
    id: 'french_fries',
    name: 'French Fries',
    nameArabic: 'بطاطا مقلية',
    category: 'Sides',
    description: 'Golden crispy fries seasoned with sea salt and wild oregano',
    descriptionArabic: 'بطاطا مقلية مقرمشة وذهبية مع رشة ملح وزعتر بري',
    priceCents: 300, // $3.00
    availableModifiers: [
      COMMON_MODIFIERS.extra_garlic,
      COMMON_MODIFIERS.spicy,
    ],
  },
  {
    id: 'garlic_sauce',
    name: 'Garlic Sauce',
    nameArabic: 'كريم ثوم (توم)',
    category: 'Sides',
    description: 'Traditional Lebanese garlic toum whipped with lemon and oil',
    descriptionArabic: 'توم لبناني أصلي مخفوق مع الحامض وزيت الزيتون',
    priceCents: 100, // $1.00
    availableModifiers: [],
  },
  {
    id: 'soft_drink',
    name: 'Soft Drink',
    nameArabic: 'مشروب غازي',
    category: 'Beverages',
    description: 'Chilled canned soda (Coke, Diet Coke, Sprite)',
    descriptionArabic: 'مشروب غازي بارد (كولا، دايت كولا، أو سبرايت)',
    priceCents: 200, // $2.00
    availableModifiers: [
      COMMON_MODIFIERS.coke,
      COMMON_MODIFIERS.diet_coke,
      COMMON_MODIFIERS.sprite,
    ],
  },
  {
    id: 'fresh_lemonade',
    name: 'Fresh Lemonade',
    nameArabic: 'ليموناضة طازجة',
    category: 'Beverages',
    description: 'Fresh squeezed Lebanese lemons with fresh mint and orange blossom water',
    descriptionArabic: 'عصير حامض طبيعي طازج مع نعناع طازج وماء زهر',
    priceCents: 300, // $3.00
    availableModifiers: [],
  },
];

export const STANDARD_DELIVERY_FEE_CENTS = 250; // $2.50 USD standard delivery fee

export function findMenuItemById(idOrName: string): MenuItem | undefined {
  const normalized = idOrName.toLowerCase().trim().replace(/[-_]/g, ' ');
  return BAYTNA_MENU.find((item) => {
    if (item.id === idOrName) return true;
    const nameNorm = item.name.toLowerCase();
    const nameArNorm = item.nameArabic.toLowerCase();
    return nameNorm === normalized || 
           nameNorm.includes(normalized) ||
           nameArNorm === normalized ||
           nameArNorm.includes(normalized);
  });
}
