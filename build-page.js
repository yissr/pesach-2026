const fs = require('fs');
const path = require('path');

const DIR = __dirname;

// Load data
const ggItems = JSON.parse(fs.readFileSync(path.join(DIR, 'gg-specials.json'), 'utf8'));
const npgsItems = JSON.parse(fs.readFileSync(path.join(DIR, 'npgs-specials.json'), 'utf8'));
const evergreenItems = JSON.parse(fs.readFileSync(path.join(DIR, 'evergreen-specials.json'), 'utf8'));
const bingoItems = JSON.parse(fs.readFileSync(path.join(DIR, 'bingo-specials.json'), 'utf8'));
const aisle9Items = JSON.parse(fs.readFileSync(path.join(DIR, 'aisle9-specials.json'), 'utf8'));

const STORES = {
  bingo: { name: 'Bingo Wholesale', color: '#16a34a', badge: 'BINGO' },
  gg: { name: 'Gourmet Glatt', color: '#2563eb', badge: 'GG' },
  npgs: { name: 'NPGS', color: '#ea580c', badge: 'NPGS' },
  evergreen: { name: 'Evergreen', color: '#0d9488', badge: 'EVG' },
  aisle9: { name: 'Aisle 9', color: '#7c3aed', badge: 'A9' },
};

// --- Price parsing ---
function parseScrapedPrice(saleDescription) {
  if (!saleDescription) return null;
  const s = saleDescription.trim();
  let m = s.match(/only\s*\$([0-9]+(?:\.[0-9]+)?)/i);
  if (m) return parseFloat(m[1]);
  m = s.match(/(?:buy\s+)?(\d+)\s+(?:units?\s+)?for\s+\$([0-9]+(?:\.[0-9]+)?)/i);
  if (m) return parseFloat(m[2]) / parseInt(m[1]);
  m = s.match(/\$([0-9]+(?:\.[0-9]+)?)/);
  if (m) return parseFloat(m[1]);
  return null;
}

function parseBingoPrice(priceDescription) {
  if (!priceDescription) return null;
  const m = priceDescription.match(/\$([0-9]+(?:\.[0-9]+)?)/);
  if (m) return parseFloat(m[1]);
  return null;
}

function formatPrice(p) {
  if (p == null) return '';
  return '$' + p.toFixed(2);
}

// --- Size parsing ---
function parseSize(title, priceDesc) {
  const combined = ((title || '') + ' ' + (priceDesc || '')).toLowerCase();

  // Check for /lb pricing (Bingo style)
  if (/\/lb\b/.test(combined)) {
    return { amount: 1, unit: 'lb', ozEquiv: 16 };
  }

  // Handle multiplier patterns: "6×50.7 oz", "5×1 LB", "cs/12", "case of 12"
  const multMatch = combined.match(/(\d+)\s*[×x]\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|lb|kg|ml|l)/i);
  if (multMatch) {
    const count = parseInt(multMatch[1]);
    const perUnit = parseFloat(multMatch[2]);
    const unitRaw = multMatch[3].toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    const unit = unitRaw === 'fl oz' ? 'fl oz' : unitRaw;
    const totalAmount = count * perUnit;
    let ozEquiv = null;
    if (unit === 'oz' || unit === 'fl oz') ozEquiv = totalAmount;
    else if (unit === 'lb') ozEquiv = totalAmount * 16;
    else if (unit === 'kg') ozEquiv = totalAmount * 35.274;
    else if (unit === 'ml') ozEquiv = totalAmount * 0.033814;
    else if (unit === 'l') ozEquiv = totalAmount * 33.814;
    return { amount: totalAmount, unit, ozEquiv };
  }

  // Patterns: "16 oz", "5 LB", "100 ct", "750 ml", "32 fl oz", "50 sq ft", "3 pk", "6 pk"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*fl\.?\s*oz/i,
    /(\d+(?:\.\d+)?)\s*oz(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*lb(?:s)?(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*kg(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*ml(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*l(?:iter)?(?:s)?(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*ct(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*(?:cnt)(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*pk(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft)(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*(?:count)(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*(?:pack)(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*(?:pc|pcs|piece)(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*(?:ft|feet)(?!\w)/i,
    /(\d+(?:\.\d+)?)\s*gram(?:s)?(?!\w)/i,
  ];

  const unitMap = [
    'fl oz', 'oz', 'lb', 'kg', 'ml', 'l', 'ct', 'ct', 'pk', 'sq ft', 'ct', 'pk', 'pc', 'ft', 'g'
  ];

  for (let i = 0; i < patterns.length; i++) {
    const m = combined.match(patterns[i]);
    if (m) {
      const amount = parseFloat(m[1]);
      const unit = unitMap[i];
      let ozEquiv = null;

      if (unit === 'oz' || unit === 'fl oz') ozEquiv = amount;
      else if (unit === 'lb') ozEquiv = amount * 16;
      else if (unit === 'kg') ozEquiv = amount * 35.274;
      else if (unit === 'ml') ozEquiv = amount * 0.033814;
      else if (unit === 'l') ozEquiv = amount * 33.814;

      return { amount, unit, ozEquiv };
    }
  }

  return null;
}

// --- Normalize for matching ---
const BRAND_NAMES = [
  "lieber's", "liebers", "gefen", "haddar", "bloom's", "blooms", "paskesz",
  "unger's", "ungers", "osem", "bodek", "pardes", "galil", "mehadrin",
  "gevina", "goldbaum", "kedem", "tuscanini", "tuscanni", "gold's", "golds",
  "heinz", "manischewitz", "streit's", "streits", "yehuda", "season",
  "rokeach", "tabatchnick", "goodman's", "goodmans", "mishpacha", "prigat",
  "elite", "bartenura", "glicks", "glick's", "kineret", "macabee", "meal mart",
  "empire", "alle", "teva", "lipton", "ken's", "kens",
  "be'er mayim", "beer mayim", "beermayim", "mayim chaim",
  "schmerling", "schmerling's", "schmerlings",
  "camille bloch", "camille", "carmit", "alprose",
  "torino", "oneg", "heaven & earth", "heaven and earth",
  "ohr", "ner mitzvah", "jet foil", "jetfoil",
  "simcha", "sharp", "plastico", "dining collection",
  "best bev", "plastic house", "infinity", "table settings",
  "cuisine", "kosher cook",
  "similac", "taster's choice", "tasters choice",
  "wissotzky", "flag", "alpine", "velvet",
  "schwartz", "upstream", "marvid", "solomon's", "solomons",
  "babad", "sizgit", "haggada", "oberlander",
  "seagull", "ossie's", "ossies", "a&b",
  "givat", "tuv ta'am", "flaum's", "flaums", "norman's", "normans",
  "ha'olam", "haolam", "golden flow", "klein's", "kleins", "sprinkles",
  "nature's own", "pandora", "dagim", "yumtee"
];
const BRAND_RE = new RegExp('\\b(' + BRAND_NAMES.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');

const FILLER_WORDS = /\b(?:farms|collection|natural|premium|original|classic|deluxe|style|brand|fancy|select|quality|fine|fresh|homestyle|home\s*style|traditional|extra|special|new|great|value|with|and|the|in|of|for|family|pack|case|assorted|cup|hour|hours)\b/gi;

function normalizeForMatch(title) {
  let s = (title || '').toLowerCase();
  // Normalize smart quotes to straight apostrophe
  s = s.replace(/[\u2018\u2019\u201A\u02BC\u02BB]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E]/g, '"');
  // Remove size/weight text
  s = s.replace(/\d+(?:\.\d+)?\s*(?:fl\.?\s*oz|oz|lb|lbs|kg|ml|l|ct|cnt|pk|sq\.?\s*ft|count|pack)\b/gi, '');
  // Remove common descriptors
  s = s.replace(/\b(?:passover|kfp|gluten\s*free|non[- ]?gebrokts?|kosher)\b/gi, '');
  s = s.replace(/\[kfp\]/gi, '');
  // Synonym normalization
  s = s.replace(/\btablecloth\b/g, 'table cover');
  s = s.replace(/\btablecloths\b/g, 'table cover');
  s = s.replace(/\bconfectioner(?:s|y)?\b/g, 'confection');
  s = s.replace(/\bconfectionary\b/g, 'confection');
  s = s.replace(/\btealight(?:s)?\b/g, 'tea light');
  s = s.replace(/\bdishwashing\b/g, 'dish');
  s = s.replace(/\bdish\s*soap\b/g, 'dish liquid');
  s = s.replace(/\bdish\s*liquid\b/g, 'dish liquid');
  s = s.replace(/\bdrumstick(?:s)?\b/g, 'leg');
  s = s.replace(/\bsparkling\b/g, 'sparkling');
  s = s.replace(/\bselt?zer\b/g, 'seltzer');
  s = s.replace(/\bcutlery\b/g, 'cutlery');
  s = s.replace(/\bfork(?:s)?\b/g, 'cutlery');
  s = s.replace(/\bknive?(?:s)?\b/g, 'cutlery');
  s = s.replace(/\bspoon(?:s)?\b/g, 'cutlery');
  s = s.replace(/\bteaspoon(?:s)?\b/g, 'cutlery');
  s = s.replace(/\butensil(?:s)?\b/g, 'cutlery');
  // Remove color/style words that prevent matching (but not "light" - used in tea lights)
  s = s.replace(/\b(?:white|clear|black|blue|gold|silver|pink|rose|spring|forest|berrie|oxy|plu|ultra)\b/g, '');
  // "glass" only as container descriptor, not when it means something
  s = s.replace(/\bglass\b/g, '');
  // Remove brand names
  s = s.replace(BRAND_RE, '');
  // Remove filler words
  s = s.replace(FILLER_WORDS, '');
  // Remove punctuation
  s = s.replace(/[^a-z0-9\s]/g, '');
  // Basic depluralize: strip trailing 's' but not 'ss'
  s = s.replace(/\b(\w{3,})s\b/g, (m, word) => word.endsWith('s') ? m : word);
  // Sort words alphabetically for order-independent matching
  s = s.replace(/\s+/g, ' ').trim();
  s = s.split(' ').filter(Boolean).sort().join(' ');
  return s;
}

// --- Categorization ---
// Consolidated categories — no overlaps
const CATEGORY_RULES = [
  ['Matzah', /\b(matz|shmura|farfel|matzo)\b/i],
  ['Meat & Poultry', /\b(chicken|beef|turkey|veal|meat|flanken|brisket|steak|roast|kishka|nugget|meatball|pastrami|schnitzel|cutlet|pulke|drumstick|cornish|lamb|pargiot|ground|london broil|chuck|rib\b|chop)\b/i],
  ['Fish & Sushi', /\b(salmon|tuna|fish|gefilte|tilapia|carp|herring|lox|whitefish|sushi|roll\b|sashimi|kani)\b/i],
  ['Dairy & Eggs', /\b(cheese|milk|yogurt|cream|butter|edam|whip|ice cream|egg|leben|sour cream|cottage|mozzarella|muenster|feta|cheddar|string cheese|slims)\b/i],
  ['Produce', null], // special handling below
  ['Oils', /\b(oil\b|olive oil|cooking spray|avocado oil)\b/i],
  ['Baking', /\b(flour|sugar|cake mix|cocoa|pudding|starch|pie crust|almond meal|coating|crumb|baking|confectioner|brown sugar|vanilla sugar|syrup|date syrup|maple syrup)\b/i],
  ['Condiments & Pantry', /\b(ketchup|sauce|dressing|mustard|mayo|mayonnaise|vinegar|honey\b|jam|preserves|horseradish|relish|hummus|tehina|techina|olives?|pickles?|gherkin|cucumber.*brine|hearts of palm|mushroom|tomato|garlic|onion powder|cinnamon|paprika|pepper\b|salt\b|spice|seasoning|soup mix|broth|mandel|crouton|ramen|noodle)\b/i],
  ['Snacks & Chips', /\b(chips?|diddle|stix|fries|pretzel|crackers?|bissli|wonton|yum yum|popcorn|rice cake|corn cake|corn chip)\b/i],
  ['Sweets & Baked Goods', /\b(cookie|brownie|cake\b|muffin|cupcake|wafer|cremeo|macaroon|finger|graham|candy|lollypop|lollipop|gummy|gummi|jelly|taffy|marshmallow|chocolate|fruit slice|non pareil|sour worm|fruit jewel|fruit snap|licorice|halva|fruit snack|fruit roll|gusher|twizzler|jolly rancher|snack pouch|chew|lick)\b/i],
  ['Beverages', /\b(juice|seltzer|wine|coke|coffee|tea\b|tea bag|soda|sparkling|beverage|drink|water\b|cocoa mix|hot cocoa)\b/i],
  ['Cereal', /\b(cereal|ringee|cocoa ball|puffer|crispy-o|granola|cheerios|honey comb)\b/i],
  ['Disposables & Paper', /\b(plates?|cups?|tumblers?|bowls?|forks?|spoons?|knives?|knife|teaspoons?|cutlery|flatware|chargers?|combo plate|dinner plate|salad plate|lunch plate|aluminum pan|aluminium|foil\b|parchment|table cover|tablecloth|counter cover|napkins?|trash bag|garbage bag|drawstring bag|sandwich bag|storage bag|ziplock|zip n close|deli container|container combo|bread bag|challah bag|paper towel|counter liner|counter saver)\b/i],
  ['Household', /\b(candle|neronim|match|soap|cleaner|bleach|towel|tissue|wipes?|liner|peeler|shirt|tzitzis|urn|memorial|sponge|gloves?|broom|mop|dish soap|dishwashing|palmolive|windex|murphy|soft scrub|scrub|detergent|laundry|fabric|dryer|air freshener|light bulb|battery|game|seder|haggad|tzitzis|chair)\b/i],
];

const PRODUCE_RE = /\b(apples?|oranges?|potatoes?|onions?|grapes?|lemons?|grapefruit|mango|tomato|peppers?|carrots?|celery|lettuce|cucumbers?|avocado|strawberr|blueberr|raspberr|banana|melon|pineapple|broccoli|cauliflower|spinach|floret|passion fruit)\b/i;
const PRODUCE_EXCLUDE = /\b(potato chip|potato stick|potato snack|potato starch|potato pancake|french fried potato|grape juice|apple juice|orange juice|applesauce|apple sauce|apple chip|apple cider|tomato sauce|tomato paste|tomato basil|lemon juice|lemon citrus|lemon dish|lemon soda|soft scrub|dishwashing|dish liquid|dish soap|onion soup|onion ring|onion powder|onion coating|onion crumb|onion fries|fried onion|diced onion|frozen.*onion|onion.*garlic.*potato|onion.*snack|mandarin orange|orange flavor|orange soda|cucumber.*brine|mini cucumber|cauliflower floret|crackers|pasta sauce|blaster|palmolive|gal gal|avocado oil|avocado roll|avocado spread|yogurt.*mango|mango yogurt|mango chunk|frozen.*mango|jolly rancher|watermelon.*candy|strawberr.*yogurt|strawberr.*jam|strawberr.*preserve|blueberr.*yogurt|blueberr.*jam|pineapple.*yogurt|banana.*chip|banana.*yogurt|pepper.*jack|pepper.*hummus|celery salt|lettuce wrap|spinach.*frozen|spinach.*chopped|broccoli.*frozen|broccoli.*floret|french fried|fries|onion.*mini|onion.*crunchy|pickled.*pepper|hot pepper)\b/i;
const SNACK_STICK_RE = /\b(potato\s+stick)\b/i;

function categorize(title) {
  const t = title || '';
  // Tea lights → Household (before Beverages catches "tea")
  if (/\btea\s*light/i.test(t) || /\btealight/i.test(t)) return 'Household';
  // Snack sticks override
  if (SNACK_STICK_RE.test(t)) return 'Snacks & Chips';
  // Aluminum pans → Disposables
  if (/\baluminum\b/i.test(t) || /\boblong\b.*\bpan\b/i.test(t)) return 'Disposables & Paper';
  // Check rules in order (specific categories first, before Produce)
  for (const [cat, re] of CATEGORY_RULES) {
    if (!re) continue;
    if (re.test(t)) return cat;
  }
  // Produce last — only if no other category matched and exclusions don't apply
  if (PRODUCE_RE.test(t) && !PRODUCE_EXCLUDE.test(t)) return 'Produce';
  return 'Other';
}

// Map old Bingo categories to new consolidated ones
const CATEGORY_MAP = {
  'Baking & Pantry': 'Baking',
  'Sweets & Snacks': 'Sweets & Baked Goods',
  'Cookies & Baked Goods': 'Sweets & Baked Goods',
  'Candy': 'Sweets & Baked Goods',
  'Disposables': 'Disposables & Paper',
  'Disposables & Foil': 'Disposables & Paper',
  'Paper & Foil': 'Disposables & Paper',
  'Cleaning Supplies': 'Household',
  'Passover Essentials': 'Household',
  'Condiments': 'Condiments & Pantry',
  'Fish': 'Fish & Sushi',
};

// --- Normalize items from all stores ---
function normalizeScraped(items, storeId) {
  return items
    .filter(i => i.title && i.title.trim())
    .map(i => {
      const price = parseScrapedPrice(i.saleDescription);
      const size = parseSize(i.title, i.saleDescription);
      const perUnit = (price != null && size && size.ozEquiv) ? price / size.ozEquiv : null;
      return {
        title: i.title.trim(),
        brand: (i.brand || '').trim(),
        price,
        priceDisplay: price != null ? formatPrice(price) : (i.saleDescription || ''),
        store: storeId,
        storeName: STORES[storeId].name,
        saleDescription: i.saleDescription || '',
        promotionTag: i.promotionTag || '',
        saleStart: i.saleStart || '',
        saleEnd: i.saleEnd || '',
        regularPrice: i.regularPrice || '',
        category: '',
        note: '',
        perOz: '',
        sizeAlert: false,
        size,
        perUnit,
      };
    });
}

function normalizeBingo(items) {
  return items
    .filter(i => i.title && i.title.trim())
    .map(i => {
      const price = parseBingoPrice(i.priceDescription);
      const size = parseSize(i.title, i.priceDescription);
      const perUnit = (price != null && size && size.ozEquiv) ? price / size.ozEquiv : null;
      // Extract brand from priceDescription (format: "$X.XX · BrandName ...")
      let bingoBrand = '';
      const brandMatch = (i.priceDescription || '').match(/·\s*([A-Za-z][A-Za-z\s&'.-]+?)(?:\s+\d|\s*$)/);
      if (brandMatch) bingoBrand = brandMatch[1].trim();
      return {
        title: i.title.trim(),
        brand: bingoBrand,
        price,
        priceDisplay: i.priceDescription || '',
        store: 'bingo',
        storeName: STORES.bingo.name,
        saleDescription: i.priceDescription || '',
        promotionTag: '',
        saleStart: '',
        saleEnd: '',
        regularPrice: '',
        category: i.category || '',
        note: i.note || '',
        perOz: i.perOz || '',
        sizeAlert: !!i.sizeAlert,
        size,
        perUnit,
      };
    });
}

// --- Build ---
let allItems = [
  ...normalizeScraped(ggItems, 'gg'),
  ...normalizeScraped(npgsItems, 'npgs'),
  ...normalizeScraped(evergreenItems, 'evergreen'),
  ...normalizeScraped(aisle9Items, 'aisle9'),
  ...normalizeBingo(bingoItems),
];

// Auto-categorize ALL items for consistency across stores
allItems.forEach(item => {
  item.category = categorize(item.title);
});

// Deduplicate within each store
const seen = new Set();
allItems = allItems.filter(item => {
  const key = `${item.store}|${item.title}|${item.price}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Clean display titles: remove Gluten Free, KFP, Non-Gebrokts, Passover, etc.
function cleanTitle(t) {
  return t
    .replace(/\bGluten\s*Free\b/gi, '')
    .replace(/\bNon[- ]?Gebrokts?\b/gi, '')
    .replace(/\[KFP\]/gi, '')
    .replace(/\(Kfp\)/gi, '')
    .replace(/\bKosher\s+for\s+Passover\b/gi, '')
    .replace(/\bPassover\b/gi, '')
    .replace(/\bKfp\b/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[,\s]+/, '')
    .replace(/[,\s]+$/, '')
    .trim();
}

// Also clean item titles for display (and better matching in later passes)
for (const item of allItems) {
  item.title = cleanTitle(item.title);
}

// --- Group items for comparison ---
// Two-pass grouping:
// Pass 1: brand-aware (keeps Carmit vs Alprose separate)
// Pass 2: merge brandless/store-brand groups into branded groups by product name
const STORE_BRANDS = new Set(['blupantry', 'blupantrysp', 'blupantrycs', 'blushine', 'blutago', 'bingo', 'evergreen', 'a9', 'plastx', 'plastxforks', 'stmoritz', '']);
const groupMap = new Map();
for (const item of allItems) {
  const normBrand = (item.brand || '').toLowerCase().replace(/[^a-z]/g, '');
  const matchKey = item.category + '|' + normBrand + '|' + normalizeForMatch(item.title);
  if (!groupMap.has(matchKey)) {
    groupMap.set(matchKey, []);
  }
  groupMap.get(matchKey).push(item);
}

// Pass 2: merge store-brand/brandless groups into branded groups with same category+product
// Uses word-subset matching: if all core words in the store-brand key appear in a branded key, merge
const SIZE_WORDS = /\b(?:large|small|medium|lg|sm|med|mini|jumbo|lite|light|heavy|duty|extra|premium|fancy|case)\b/g;
function coreWords(normTitle) {
  return normTitle.replace(SIZE_WORDS, '').replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ');
}
const brandedGroups = []; // [{key, category, coreProduct}]
const storeBrandKeys = [];
for (const [key] of groupMap) {
  const parts = key.split('|');
  const brand = parts[1];
  const category = parts[0];
  const product = parts.slice(2).join('|');
  if (STORE_BRANDS.has(brand)) {
    storeBrandKeys.push({ key, category, product, core: coreWords(product) });
  } else {
    brandedGroups.push({ key, category, product, core: coreWords(product) });
  }
}
for (const sb of storeBrandKeys) {
  if (!sb.core) continue; // skip empty after stripping
  // Find best branded match: same category, core words are subset
  const sbWords = new Set(sb.core.split(' '));
  let bestMatch = null;
  let bestOverlap = 0;
  for (const bg of brandedGroups) {
    if (bg.category !== sb.category) continue;
    const bgWords = bg.core.split(' ');
    const overlap = bgWords.filter(w => sbWords.has(w)).length;
    const smaller = Math.min(sbWords.size, bgWords.length);
    // For single-word products, require exact match to avoid "sugar" matching "vanilla sugar"
    // For multi-word, allow subset matching but require overlap >= 60% of the larger set
    const larger = Math.max(sbWords.size, bgWords.length);
    const isExact = sbWords.size === bgWords.length && overlap === sbWords.size;
    const isSubset = smaller >= 2 && overlap === smaller && overlap / larger >= 0.6;
    if ((isExact || isSubset) && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = bg;
    }
  }
  if (bestMatch && bestOverlap >= 1 && groupMap.has(sb.key)) {
    // Merge store-brand items into the branded group
    groupMap.get(bestMatch.key).push(...groupMap.get(sb.key));
    groupMap.delete(sb.key);
  }
}

// Pass 3: merge groups with same category + overlapping core product across ALL brands
// For commodity items (potato starch, almond flour, olive oil, etc.) brand doesn't matter
// Uses subset matching: if core words of one group are a subset of another's, merge them
const VARIANT_WORDS = /\b(?:white|super|fine|low|carb|free|gluiten|gluten|meal|pure|natural|real|whole|ground|organic|processed|dutch|100|clover|blossom|homogenized|cane|granulated|refined)\b/gi;
function baseProduct(normTitle) {
  return coreWords(normTitle).replace(VARIANT_WORDS, '').replace(/\s+/g, ' ').trim();
}
const baseGroupMap = new Map(); // "category|baseProduct" -> first key seen
const keysToMerge = new Map(); // target key -> [source keys]
for (const [key] of groupMap) {
  const parts = key.split('|');
  const category = parts[0];
  const product = parts.slice(2).join('|');
  const base = baseProduct(product);
  if (!base) continue;
  const baseKey = category + '|' + base;
  if (baseGroupMap.has(baseKey)) {
    const target = baseGroupMap.get(baseKey);
    if (target !== key) {
      if (!keysToMerge.has(target)) keysToMerge.set(target, []);
      keysToMerge.get(target).push(key);
    }
  } else {
    baseGroupMap.set(baseKey, key);
  }
}
for (const [target, sources] of keysToMerge) {
  if (!groupMap.has(target)) continue;
  for (const src of sources) {
    if (!groupMap.has(src)) continue;
    groupMap.get(target).push(...groupMap.get(src));
    groupMap.delete(src);
  }
}

const groups = [];
for (const [key, items] of groupMap) {
  const category = items[0].category;

  let entries = items.map(item => {
    const isWeight = item.size && (item.size.unit === 'oz' || item.size.unit === 'fl oz' || item.size.unit === 'lb' || item.size.unit === 'kg' || item.size.unit === 'ml' || item.size.unit === 'l');
    const isCount = item.size && (item.size.unit === 'ct' || item.size.unit === 'pk');
    let perUnitDisplay = '';
    if (item.perUnit != null && isWeight) {
      perUnitDisplay = (item.perUnit * 100).toFixed(1) + '\u00A2/oz';
    } else if (item.price != null && isCount && item.size.amount > 0) {
      const perEach = item.price / item.size.amount;
      perUnitDisplay = '$' + perEach.toFixed(2) + '/ea';
    }

    return {
      store: item.store,
      price: item.price,
      priceDisplay: item.priceDisplay,
      perUnit: item.perUnit,
      perUnitDisplay,
      regularPrice: item.regularPrice,
      saleEnd: item.saleEnd,
      saleStart: item.saleStart,
      size: item.size,
      brand: item.brand,
      title: item.title,
      note: item.note,
      perOz: item.perOz,
      saleDescription: item.saleDescription,
      promotionTag: item.promotionTag,
      sizeAlert: item.sizeAlert,
    };
  });

  // Compute comparable unit cost for an entry
  function unitCostOf(e) {
    if (e.perUnit != null) return e.perUnit;
    if (e.price != null && e.size && (e.size.unit === 'ct' || e.size.unit === 'pk') && e.size.amount > 0) return e.price / e.size.amount;
    return null;
  }

  // Deduplicate: keep only the cheapest entry per store
  {
    const byStore = {};
    for (const e of entries) {
      const cost = unitCostOf(e) ?? e.price;
      if (!byStore[e.store] || (cost != null && (byStore[e.store].cost == null || cost < byStore[e.store].cost))) {
        byStore[e.store] = { entry: e, cost };
      }
    }
    entries = Object.values(byStore).map(v => v.entry);
  }

  // Pick display title from deduped entries: longest title
  const rawTitle = entries.reduce((a, b) => a.title.length >= b.title.length ? a : b).title;
  const displayTitle = cleanTitle(rawTitle);

  // Determine winner: lowest per-unit (oz or each), with near-tie tolerance (2%)
  let winner = null;
  if (entries.length > 1) {
    const withCost = entries.map(e => ({ ...e, unitCost: unitCostOf(e) })).filter(e => e.unitCost != null);

    if (withCost.length > 1) {
      const sorted = [...withCost].sort((a, b) => a.unitCost - b.unitCost);
      // Treat within 2% as a tie
      const diff = (sorted[1].unitCost - sorted[0].unitCost) / sorted[0].unitCost;
      if (diff > 0.02) winner = sorted[0].store;
    } else {
      // Fallback to flat price only if same unit/size
      const withPrice = entries.filter(e => e.price != null);
      if (withPrice.length > 1) {
        const sorted = [...withPrice].sort((a, b) => a.price - b.price);
        const diff = (sorted[1].price - sorted[0].price) / sorted[0].price;
        if (diff > 0.02) winner = sorted[0].store;
      }
    }
  }

  // Comparison note
  let compNote = '';
  if (entries.length >= 2) {
    const withPerUnit = entries.filter(e => e.perUnit != null);
    // Check if same unit type
    const weightEntries = withPerUnit.filter(e => e.size && ['oz','fl oz','lb','kg','ml','l'].includes(e.size.unit));
    const countEntries = entries.filter(e => e.size && ['ct','pk'].includes(e.size.unit) && e.price != null);

    if (weightEntries.length >= 2) {
      const sorted = [...weightEntries].sort((a, b) => a.perUnit - b.perUnit);
      const parts = sorted.map(e => STORES[e.store].badge + ' ' + (e.perUnit * 100).toFixed(1) + '\u00A2/oz');
      const isTie = sorted[0].perUnit === sorted[1].perUnit;
      compNote = parts.join(' vs ') + (isTie ? ' \u2014 tie' : ' \u2014 ' + STORES[sorted[0].store].badge + ' wins');
    } else if (countEntries.length >= 2) {
      const sorted = [...countEntries].sort((a, b) => (a.price / a.size.amount) - (b.price / b.size.amount));
      const parts = sorted.map(e => STORES[e.store].badge + ' $' + (e.price / e.size.amount).toFixed(2) + '/ea');
      const isTie = (sorted[0].price / sorted[0].size.amount) === (sorted[1].price / sorted[1].size.amount);
      compNote = parts.join(' vs ') + (isTie ? ' \u2014 tie' : ' \u2014 ' + STORES[sorted[0].store].badge + ' wins');
    }
  }

  // Detect if sizes vary or are missing for some entries
  let sizesVary = false;
  {
    const sizeStrs = entries.map(e => e.size ? `${e.size.amount}${e.size.unit}` : null);
    const uniqueSizes = [...new Set(sizeStrs)];
    if (uniqueSizes.length > 1) sizesVary = true; // includes null vs actual size
  }

  // Size alert: entries differ by >50% in size
  let sizeAlert = false;
  let sizeAlertText = '';
  const sizesWithOz = entries.filter(e => e.size && e.size.ozEquiv);
  if (sizesWithOz.length >= 2) {
    const maxOz = Math.max(...sizesWithOz.map(e => e.size.ozEquiv));
    const minOz = Math.min(...sizesWithOz.map(e => e.size.ozEquiv));
    if (maxOz > minOz * 1.5) {
      sizeAlert = true;
      const parts = sizesWithOz.map(e => {
        const displayAmt = e.size.unit === 'lb' ? e.size.amount + 'lb' : Math.round(e.size.ozEquiv) + 'oz';
        return STORES[e.store].badge + ' ' + displayAmt;
      });
      sizeAlertText = '\u26A0\uFE0F Size differs: ' + parts.join(' vs ') + ' \u2014 compare carefully';
    }
  }

  const sortKey = key.split('|').slice(1).join('|');
  groups.push({
    key: sortKey,
    displayTitle,
    category,
    entries,
    winner,
    compNote,
    sizeAlert,
    sizeAlertText,
    sizesVary,
    stores: [...new Set(entries.map(e => e.store))],
  });
}

// Sort groups by category then normalized key (so similar products cluster together)
groups.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key) || a.displayTitle.localeCompare(b.displayTitle));


// Count by store and category (based on groups)
const storeCounts = {};
const catCounts = {};
for (const g of groups) {
  for (const e of g.entries) {
    storeCounts[e.store] = (storeCounts[e.store] || 0) + 1;
  }
  catCounts[g.category] = (catCounts[g.category] || 0) + 1;
}

const categories = [...new Set(groups.map(g => g.category))].sort();

const CAT_ICONS = {
  'Matzah': '\uD83E\uDED3',
  'Meat & Poultry': '\uD83E\uDD69',
  'Fish & Sushi': '\uD83D\uDC1F',
  'Dairy & Eggs': '\uD83E\uDDC0',
  'Produce': '\uD83E\uDD6C',
  'Oils': '\uD83E\uDED2',
  'Baking': '\uD83E\uDDC1',
  'Condiments & Pantry': '\uD83E\uDED9',
  'Snacks & Chips': '\uD83C\uDF7F',
  'Sweets & Baked Goods': '\uD83C\uDF6A',
  'Beverages': '\uD83E\uDD64',
  'Cereal': '\uD83E\uDD63',
  'Disposables & Paper': '\uD83C\uDF7D\uFE0F',
  'Household': '\uD83C\uDFE0',
  'Other': '\uD83D\uDCE6',
};

function formatDateShort(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

console.log(`Total items: ${allItems.length}`);
console.log(`Total groups: ${groups.length}`);
console.log('By store:', storeCounts);
console.log('Categories:', categories.length);

fs.writeFileSync(path.join(DIR, 'index.html'), generateHTML());

function generateHTML() {
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Build table rows grouped by category
  const categoryTablesHTML = categories.map(cat => {
    const catGroups = groups.filter(g => g.category === cat);

    const rowsHTML = catGroups.map((g, ci) => {
      const groupIdx = groups.indexOf(g);
      const storeList = g.stores.join(',');
      const hasMultiple = g.entries.length > 1;
      const clickableClass = hasMultiple ? ' clickable' : '';

      // Find best entry (winner or lowest price)
      let best = g.entries[0];
      if (g.winner) {
        const w = g.entries.find(e => e.store === g.winner);
        if (w) best = w;
      } else {
        const withPrice = g.entries.filter(e => e.price != null);
        if (withPrice.length > 0) {
          best = withPrice.reduce((a, b) => a.price < b.price ? a : b);
        }
      }

      const bestPriceStr = best.priceDisplay || '\u2014';
      const bestStore = STORES[best.store];
      const bestPerUnit = best.perUnitDisplay || '';
      const sizeStr = best.size ? best.size.amount + ' ' + best.size.unit : '';
      const brandStr = best.brand || '';
      const storeCount = g.stores.length;
      const winnerColor = g.winner ? STORES[g.winner].color : '';

      // Main row
      let rowHTML = `<div class="row${clickableClass}${g.sizeAlert ? ' size-alert' : ''}" data-group="${groupIdx}" data-cat="${esc(g.category)}" data-stores="${storeList}" data-winner="${g.winner || ''}"${hasMultiple ? ` onclick="toggleDetail(${groupIdx})"` : ''}>`;
      rowHTML += `<div class="cb"><input type="checkbox" id="cb-${groupIdx}-${best.store}" onchange="toggleCart(${groupIdx},'${best.store}',this.checked)" onclick="event.stopPropagation()" title="Add to list"></div>`;
      // Show brand and size inline
      const itemBrand = best.brand ? best.brand : '';
      const itemSize = best.size ? best.size.amount + ' ' + best.size.unit : '';
      const itemMeta = [itemBrand, itemSize].filter(Boolean).join(' · ');
      rowHTML += `<div class="item-name">${esc(g.displayTitle)}`;
      if (itemMeta) rowHTML += ` <span class="item-meta">${esc(itemMeta)}</span>`;
      if (g.sizeAlert) rowHTML += ` <span class="size-flag">\u26A0\uFE0F</span>`;
      if (hasMultiple) rowHTML += ` <span class="arrow" id="arrow-${groupIdx}">\u25B8</span>`;
      rowHTML += `</div>`;
      rowHTML += `<div class="cell best-price">${esc(bestPriceStr)}</div>`;
      rowHTML += `<div class="cell best-store"><span class="store-tag" style="color:${bestStore.color}">${bestStore.badge}</span>`;
      if (storeCount > 1) rowHTML += ` <span class="store-count">${storeCount} stores</span>`;
      rowHTML += `</div>`;
      rowHTML += `<div class="cell per-unit-cell">${bestPerUnit ? esc(bestPerUnit) : ''}</div>`;
      rowHTML += `</div>`;

      // Detail rows (hidden by default)
      if (hasMultiple) {
        let detailHTML = `<div class="detail" id="detail-${groupIdx}">`;
        const storeOrder = ['bingo', 'gg', 'npgs', 'evergreen', 'aisle9'];
        for (const sid of storeOrder) {
          const entry = g.entries.find(e => e.store === sid);
          const store = STORES[sid];
          if (entry) {
            const isWinner = g.winner === sid;
            const winClass = isWinner ? ' detail-winner' : '';
            const brandSuffix = entry.brand ? ` \u00B7 ${esc(entry.brand)}` : '';
            const sizeSuffix = entry.size ? ` ${entry.size.amount} ${entry.size.unit}` : '';
            const perUnitSuffix = entry.perUnitDisplay ? ` (${esc(entry.perUnitDisplay)})` : '';
            detailHTML += `<div class="detail-row${winClass}">`;
            detailHTML += `<input type="checkbox" id="cb-${groupIdx}-${sid}" onchange="toggleCart(${groupIdx},'${sid}',this.checked)" onclick="event.stopPropagation()" title="Add to list">`;
            detailHTML += `<span class="detail-store" style="color:${store.color}">${store.badge}</span>`;
            detailHTML += `<span class="detail-price">${esc(entry.priceDisplay)}${brandSuffix}${sizeSuffix}${perUnitSuffix}</span>`;
            if (isWinner) detailHTML += `<span class="winner-mark">\u2605 BEST</span>`;
            detailHTML += `</div>`;
          } else {
            detailHTML += `<div class="detail-row detail-empty">`;
            detailHTML += `<span class="detail-store" style="color:${store.color}">${store.badge}</span>`;
            detailHTML += `<span class="detail-dash">\u2014</span>`;
            detailHTML += `</div>`;
          }
        }
        if (g.compNote) {
          detailHTML += `<div class="comp-note">\uD83D\uDCCF ${esc(g.compNote)}</div>`;
        }
        if (g.sizeAlert && g.sizeAlertText) {
          detailHTML += `<div class="comp-note alert">${g.sizeAlertText}</div>`;
        }
        detailHTML += `</div>`;
        rowHTML += detailHTML;
      }

      return rowHTML;
    }).join('\n');

    return `<div class="cat" data-category="${esc(cat)}">
  <div class="cat-title" onclick="toggleCat(this)">
    <span class="cat-icon">${CAT_ICONS[cat] || '\uD83D\uDCE6'}</span>
    <span>${esc(cat)}</span>
    <span class="cat-count">(${catGroups.length})</span>
    <span class="cat-toggle">\u25BC</span>
  </div>
  <div class="tbl">
    <div class="tbl-head">
      <div></div>
      <div>Item</div>
      <div>Best Price</div>
      <div>Store</div>
      <div>Per Unit</div>
    </div>
    <div class="tbl-body">
${rowsHTML}
    </div>
  </div>
</div>`;
  }).join('\n');

  // Store filter buttons
  const storeFilterBtns = Object.entries(STORES).map(([id, s]) =>
    `<button data-store="${id}" style="color:${s.color};border-color:${s.color}40">${s.badge} (${storeCounts[id] || 0})</button>`
  ).join('\n');

  // Winner counts per store (items where that store has the best per-unit price)
  const winnerCounts = {};
  groups.forEach(g => { if (g.winner) winnerCounts[g.winner] = (winnerCounts[g.winner] || 0) + 1; });
  const winnerFilterBtns = Object.entries(STORES).map(([id, s]) =>
    `<button data-winner="${id}" style="color:${s.color};border-color:${s.color}40">${s.badge} cheapest</button>`
  ).join('\n');

  // Category filter buttons
  const catFilterBtns = categories.map(c =>
    `<button data-cat="${esc(c)}">${CAT_ICONS[c] || '\uD83D\uDCE6'} ${esc(c)} (${catCounts[c]})</button>`
  ).join('\n');


  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pesach 2026 \u2014 Store Specials Comparison</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
  background: linear-gradient(180deg, #f0f4ff 0%, #fff 500px);
  min-height: 100vh;
}
.wrap { max-width: 960px; margin: 0 auto; padding: 20px 12px; }

/* Header */
.header {
  text-align: center; margin-bottom: 16px; padding: 20px 16px;
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%);
  border-radius: 14px; color: white;
  box-shadow: 0 4px 20px rgba(30,58,95,0.25);
}
.header .sub { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.7; }
.header h1 { margin: 4px 0 6px; font-size: 26px; font-weight: 800; }
.header .tagline { font-size: 12px; opacity: 0.75; }

/* Disclaimer */
.disclaimer {
  text-align: center; padding: 10px 14px; margin-bottom: 14px;
  border-radius: 10px; background: #fef2f2; border: 2px solid #fca5a5;
  font-size: 12px; line-height: 1.5; color: #991b1b;
}

/* KYT Banner */
.kyt-banner { display: block; margin-bottom: 14px; border-radius: 12px; overflow: hidden; }
.kyt-banner img { width: 100%; display: block; border-radius: 12px; }

/* Search */
.search-wrap { position: relative; margin-bottom: 10px; text-align: center; }
.search-wrap input {
  width: 100%; max-width: 500px; padding: 10px 40px 10px 16px;
  border-radius: 24px; border: 2px solid #e2e8f0; font-size: 14px;
  font-family: inherit; outline: none; transition: border-color 0.15s;
  background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.search-wrap input:focus { border-color: #1e3a5f; }
.search-wrap .clear-btn {
  position: absolute; right: calc(50% - 240px); top: 50%; transform: translateY(-50%);
  background: none; border: none; font-size: 16px; color: #94a3b8;
  cursor: pointer; display: none; padding: 0 4px;
}
.search-count { font-size: 11px; color: #94a3b8; margin-top: 5px; text-align: center; }

/* Filters */
.filter-label { text-align: center; font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 2px; margin-top: 8px; }
.filters { display: flex; gap: 5px; margin-bottom: 10px; justify-content: center; flex-wrap: wrap; }
.filters button {
  padding: 5px 12px; border-radius: 16px; border: 1.5px solid #ddd;
  background: #fff; color: #666; font-weight: 600; font-size: 11px;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.filters button:hover { border-color: #aaa; }
.filters button.active { border-color: #1e3a5f; background: #1e3a5f; color: #fff; }

.cat-filters { display: flex; gap: 4px; margin-bottom: 18px; justify-content: center; flex-wrap: wrap; }
.cat-filters button {
  padding: 5px 12px; border-radius: 16px; border: 1.5px solid #ddd;
  background: #fff; color: #666; font-weight: 600; font-size: 11px;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.cat-filters button:hover { border-color: #aaa; }
.cat-filters button.active { border-color: #1e3a5f; background: #1e3a5f; color: #fff; }

/* Category */
.cat { margin-bottom: 22px; }
.cat-title {
  font-size: 15px; font-weight: 700; margin-bottom: 8px;
  display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
}
.cat-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 7px;
  background: #f0f4ff; font-size: 16px;
}
.cat-count { font-size: 10.5px; font-weight: 500; color: #999; }
.cat-toggle { margin-left: auto; font-size: 12px; color: #94a3b8; }

/* Table */
.tbl {
  border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.tbl-head {
  display: grid;
  grid-template-columns: 28px minmax(140px, 2fr) minmax(80px, auto) minmax(80px, auto) minmax(70px, auto);
  background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  padding: 7px 10px; gap: 6px;
}
.tbl-head div {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.7px; color: #94a3b8;
}

/* Row */
.row {
  display: grid;
  grid-template-columns: 28px minmax(140px, 2fr) minmax(80px, auto) minmax(80px, auto) minmax(70px, auto);
  padding: 9px 10px; gap: 6px; align-items: center;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s;
}
.row:last-child { border-bottom: none; }
.row.size-alert { background: #fffef5; }
.row.in-cart { background: #f0fdf4; }
.row .cb { display: flex; align-items: center; }
.row .cb input { width: 16px; height: 16px; cursor: pointer; accent-color: #16a34a; }
.row .item-name { font-weight: 600; font-size: 12.5px; line-height: 1.3; }
.row .cell { font-size: 12px; line-height: 1.35; color: #333; font-weight: 500; }
.row .best-price { font-weight: 700; color: #1a1a1a; }
.row .best-store { display: flex; align-items: center; gap: 4px; }
.store-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; }
.store-count { font-size: 9.5px; color: #94a3b8; }
.per-unit-cell { font-size: 11px; color: #92400e; font-weight: 600; }
.item-meta { font-size: 10.5px; font-weight: 500; color: #64748b; margin-left: 4px; }
.size-flag { font-size: 11px; }
.arrow { font-size: 10px; color: #94a3b8; margin-left: 3px; }
.row.clickable { cursor: pointer; }
.row.clickable:hover { background: #fafbff; }

/* Detail (expandable) */
.detail { display: none; padding: 0 10px 8px; padding-left: 38px; }
.detail.open { display: block; }
.detail-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 8px; font-size: 12px; line-height: 1.4;
  border-bottom: 1px solid #f8f8f8;
}
.detail-row:last-child { border-bottom: none; }
.detail-row input[type=checkbox] { width: 14px; height: 14px; cursor: pointer; accent-color: #16a34a; flex-shrink: 0; }
.detail-store { font-size: 10px; font-weight: 800; min-width: 42px; flex-shrink: 0; }
.detail-price { color: #333; font-weight: 500; }
.detail-dash { color: #cbd5e1; }
.detail-empty { opacity: 0.5; }
.detail-winner { background: #f0fdf4; border-radius: 4px; }
.winner-mark { color: #16a34a; font-size: 10px; font-weight: 700; margin-left: auto; white-space: nowrap; }

/* Comparison note */
.comp-note {
  padding: 5px 10px; margin-top: 4px; border-radius: 6px;
  background: linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #fde68a;
  font-size: 11px; font-weight: 600; color: #92400e; line-height: 1.4;
}
.comp-note.alert { color: #d97706; }

/* Contact FAB */
.contact-btn {
  position: fixed; bottom: 20px; left: 20px; z-index: 1000;
  background: linear-gradient(135deg, #6366f1, #4f46e5); color: white;
  border: none; border-radius: 50px; padding: 12px 20px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
  display: flex; align-items: center; gap: 8px;
  transition: transform 0.15s; font-family: inherit;
}
.contact-btn:hover { transform: scale(1.05); }
.contact-modal {
  display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2001; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); padding: 16px;
}
.contact-modal.open { display: flex; }
.contact-form {
  background: white; border-radius: 16px; padding: 24px;
  max-width: 440px; width: 100%; box-shadow: 0 16px 48px rgba(0,0,0,0.2);
}
.contact-form h3 { margin-bottom: 16px; font-size: 18px; }
.contact-form label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #374151; }
.contact-form input, .contact-form textarea, .contact-form select {
  width: 100%; padding: 10px 12px; border: 1.5px solid #d1d5db; border-radius: 8px;
  font-size: 14px; font-family: inherit; margin-bottom: 12px;
}
.contact-form textarea { min-height: 100px; resize: vertical; }
.contact-form select { appearance: auto; }
.contact-form .cf-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
.contact-form button {
  padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; font-family: inherit; border: none;
}
.contact-form .cf-cancel { background: #f3f4f6; color: #374151; }
.contact-form .cf-submit { background: #4f46e5; color: white; }
.contact-form .cf-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.contact-form .cf-msg { font-size: 13px; margin-top: 8px; text-align: center; }

/* Cart FAB */
.cart-btn {
  position: fixed; bottom: 20px; right: 20px; z-index: 1000;
  background: linear-gradient(135deg, #16a34a, #15803d); color: white;
  border: none; border-radius: 50px; padding: 12px 20px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 16px rgba(22,163,74,0.4);
  display: none; align-items: center; gap: 8px;
  transition: transform 0.15s, box-shadow 0.15s;
  font-family: inherit;
}
.cart-btn:hover { transform: scale(1.05); }
.cart-btn .cart-count {
  background: white; color: #16a34a; border-radius: 50%;
  width: 24px; height: 24px; display: inline-flex;
  align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800;
}

/* Cart panel */
.cart-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.3); z-index: 1000;
  display: none; backdrop-filter: blur(2px);
}
.cart-overlay.open { display: block; }
.cart-panel {
  position: fixed; top: 0; right: -420px; width: 400px; max-width: 90vw;
  height: 100vh; background: #fff; z-index: 1001;
  box-shadow: -4px 0 30px rgba(0,0,0,0.15);
  transition: right 0.3s ease;
  display: flex; flex-direction: column;
}
.cart-panel.open { right: 0; }
.cart-header {
  padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  display: flex; justify-content: space-between; align-items: center;
}
.cart-header h2 { font-size: 18px; font-weight: 800; }
.cart-close {
  background: none; border: none; font-size: 22px; cursor: pointer;
  color: #94a3b8; padding: 4px 8px; border-radius: 6px;
}
.cart-close:hover { background: #f1f5f9; color: #333; }
.cart-actions {
  padding: 10px 20px; border-bottom: 1px solid #e2e8f0;
  display: flex; gap: 8px; flex-wrap: wrap;
}
.cart-actions button {
  padding: 6px 14px; border-radius: 8px; border: 1.5px solid #e2e8f0;
  background: #fff; color: #555; font-weight: 600; font-size: 12px;
  cursor: pointer; font-family: inherit;
}
.cart-actions button:hover { background: #f8fafc; }
.cart-actions button.primary { background: #16a34a; color: white; border-color: #16a34a; }
.cart-actions button.danger { color: #dc2626; border-color: #fca5a5; }
.cart-progress {
  padding: 8px 20px; border-bottom: 1px solid #e2e8f0;
  font-size: 11px; color: #64748b; background: #f8fafc;
}
.cart-progress-bar { height: 6px; border-radius: 3px; background: #e2e8f0; margin-top: 4px; overflow: hidden; }
.cart-progress-fill { height: 100%; border-radius: 3px; background: #16a34a; transition: width 0.3s; }
.cart-body { flex: 1; overflow-y: auto; padding: 12px 20px; }
.cart-empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 14px; }
.cart-store-header {
  padding: 8px 14px; margin: 0 -20px; margin-bottom: 4px;
  display: flex; justify-content: space-between; align-items: center;
  font-weight: 800; font-size: 14px; color: white;
}
.cart-store-header:not(:first-child) { margin-top: 12px; }
.cart-item {
  display: flex; align-items: center;
  padding: 6px 0; font-size: 12px; gap: 6px;
  border-bottom: 1px solid #f8f8f8;
  transition: opacity 0.2s;
}
.cart-item.got { opacity: 0.5; }
.cart-item.got .ci-name { text-decoration: line-through; color: #94a3b8; }
.cart-item input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; accent-color: #16a34a; flex-shrink: 0; }
.ci-name { font-weight: 600; color: #1a1a1a; flex: 1; min-width: 0; }
.ci-qty {
  width: 44px; padding: 3px 4px; border: 1.5px solid #e2e8f0;
  border-radius: 6px; font-size: 12px; text-align: center;
  font-family: inherit; font-weight: 600; flex-shrink: 0;
}
.ci-price { font-weight: 700; white-space: nowrap; flex-shrink: 0; font-size: 11px; }
.ci-remove {
  background: none; border: none; color: #cbd5e1; cursor: pointer;
  font-size: 14px; padding: 0 2px; flex-shrink: 0;
}
.ci-remove:hover { color: #ef4444; }

/* Footer */
.footer {
  text-align: center; padding: 14px 12px; font-size: 10.5px;
  color: #94a3b8; border-top: 1px solid #e2e8f0;
  margin-top: 8px; line-height: 1.5;
}

.hidden { display: none !important; }

/* Mobile */
@media (max-width: 640px) {
  .wrap { padding: 12px 8px; }
  .header h1 { font-size: 20px; }
  .tbl-head { display: none; }
  .row {
    grid-template-columns: 24px 1fr;
    gap: 2px;
  }
  .row .item-name { grid-column: 2; font-size: 13px; }
  .row .best-price { grid-column: 2; font-size: 12px; }
  .row .best-store { grid-column: 2; }
  .row .per-unit-cell { grid-column: 2; }
  .detail { padding-left: 28px; }
  .filters { gap: 3px; }
  .filters button { font-size: 10px; padding: 4px 9px; }
  .cat-filters button { font-size: 10px; padding: 4px 9px; }
  .cart-panel { width: 100vw; max-width: 100vw; }
}
@media print {
  .cart-btn, .search-wrap, .filters, .cat-filters, .cart-overlay, .cart-panel,
  .header, .disclaimer, .kyt-banner, .footer, .search-count { display: none !important; }
  .cart-panel { position: static; width: 100%; display: flex !important; right: 0 !important; box-shadow: none; }
}
</style>
</head>
<body>
<div class="wrap">

<div class="header">
  <div class="sub">Pesach 2026 \u2014 Complete Price Comparison</div>
  <h1>5-Store Specials Comparison</h1>
  <div class="tagline">Bingo \u00B7 Gourmet Glatt \u00B7 NPGS \u00B7 Evergreen \u00B7 Aisle 9 &mdash; Click any multi-store row to expand</div>
</div>

<div class="disclaimer">
  <strong>\u26A0\uFE0F Important:</strong> This page compares <strong>sale/promotional prices only</strong> \u2014 not everyday shelf prices. Stores like NPGS and Bingo tend to have lower everyday prices across the board, while GG often has deeper sale discounts. Occasionally one store will beat the others on a particular item. <strong>Use the shopping list feature to build your list and see which store is cheapest for each item.</strong>
  <br><br>
  Prices and availability may vary. Data was scraped from store flyers and may contain errors. Always verify in-store. Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
</div>

<a class="kyt-banner" href="https://www.rayze.it/kyt/" target="_blank" rel="noopener">
  <img src="kyt-banner.jpg" alt="KYT Banner" loading="lazy">
</a>

<div class="search-wrap">
  <input type="text" id="searchInput" placeholder="\uD83D\uDD0D Search any item, brand, store..." autocomplete="off">
  <button class="clear-btn" id="clearSearch">\u2715</button>
</div>
<div class="search-count" id="searchCount"></div>

<div class="filters" id="storeFilters">
  <button class="active" data-store="all">All (${groups.length})</button>
${storeFilterBtns}
</div>

<div class="filter-label">Cheapest at:</div>
<div class="filters" id="winnerFilters">
  <button class="active" data-winner="all">All</button>
${winnerFilterBtns}
</div>

<div class="cat-filters" id="catFilters">
  <button class="active" data-cat="all">All Categories</button>
${catFilterBtns}
</div>

<div id="content">
${categoryTablesHTML}
</div>

<div class="footer">
  <strong>\u26A0\uFE0F We are not responsible for any errors or inaccuracies. Always verify prices in-store.</strong><br>
  \u26A0\uFE0F items show per-unit breakdowns \u00B7 Click rows with multiple stores to compare \u00B7 "\u2014" = not in that store's circular
</div>

</div>

<button class="contact-btn" onclick="document.getElementById('contactModal').classList.add('open')">
  \u2709\uFE0F Contact / Submit
</button>

<div class="contact-modal" id="contactModal" onclick="if(event.target===this)this.classList.remove('open')">
  <div class="contact-form">
    <h3>\u2709\uFE0F Contact Us</h3>
    <label>Type</label>
    <select id="cfType">
      <option value="price-correction">Price Correction</option>
      <option value="suggestion">Item Suggestion</option>
      <option value="general" selected>General Feedback</option>
    </select>
    <label>Name (optional)</label>
    <input id="cfName" type="text" placeholder="Your name">
    <label>Email (optional)</label>
    <input id="cfEmail" type="email" placeholder="your@email.com">
    <label>Message *</label>
    <textarea id="cfMessage" placeholder="Tell us about a price error, suggest an item, or share feedback..."></textarea>
    <div class="cf-actions">
      <button class="cf-cancel" onclick="document.getElementById('contactModal').classList.remove('open')">Cancel</button>
      <button class="cf-submit" id="cfSubmit" onclick="submitContact()">Send</button>
    </div>
    <div class="cf-msg" id="cfMsg"></div>
  </div>
</div>

<button class="cart-btn" id="cartBtn" onclick="openCart()">
  \uD83D\uDED2 Shopping List <span class="cart-count" id="cartBtnCount">0</span>
</button>

<div class="cart-overlay" id="cartOverlay" onclick="closeCart()"></div>

<div class="cart-panel" id="cartPanel">
  <div class="cart-header">
    <h2>\uD83D\uDED2 Shopping List</h2>
    <button class="cart-close" onclick="closeCart()">\u2715</button>
  </div>
  <div class="cart-actions">
    <button class="primary" onclick="copyList()">\uD83D\uDCCB Copy</button>
    <button onclick="window.print()">\uD83D\uDDA8\uFE0F Print</button>
    <button onclick="uncheckAll()">\u21A9\uFE0F Uncheck</button>
    <button class="danger" onclick="clearCart()">\uD83D\uDDD1\uFE0F Clear</button>
  </div>
  <div class="cart-progress" id="cartProgress" style="display:none;">
    <span id="cartProgressText">0 of 0 items</span>
    <div class="cart-progress-bar"><div class="cart-progress-fill" id="cartProgressFill" style="width:0%"></div></div>
  </div>
  <div class="cart-body" id="cartBody">
    <div class="cart-empty">Check items from the comparison to build your list!</div>
  </div>
</div>

<script>
const GROUPS = ${JSON.stringify(groups).replace(/<\//g, '<\\/')};
const STORES = ${JSON.stringify(STORES).replace(/<\//g, '<\\/')};
let activeStore = 'all';
let activeCat = 'all';
let activeWinner = 'all';

// Cart: key = "groupIdx|store" -> { groupIdx, store, qty, gotten }
let cart = {};
try { cart = JSON.parse(localStorage.getItem('pesach2026cart') || '{}'); } catch(e) { cart = {}; }

function saveCart() { localStorage.setItem('pesach2026cart', JSON.stringify(cart)); }

// Toggle detail expansion
function toggleDetail(groupIdx) {
  const det = document.getElementById('detail-' + groupIdx);
  const arrow = document.getElementById('arrow-' + groupIdx);
  if (!det) return;
  const open = det.classList.toggle('open');
  if (arrow) arrow.textContent = open ? '\\u25BE' : '\\u25B8';
}

// Toggle category collapse
function toggleCat(el) {
  const tbl = el.nextElementSibling;
  if (!tbl) return;
  const collapsed = tbl.classList.toggle('hidden');
  el.querySelector('.cat-toggle').textContent = collapsed ? '\\u25B6' : '\\u25BC';
}

// Filtering
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const clearBtn = document.getElementById('clearSearch');

function doFilter() {
  const q = searchInput.value.toLowerCase().trim();
  clearBtn.style.display = q ? 'block' : 'none';
  const rows = document.querySelectorAll('.row[data-group]');
  let visible = 0;

  rows.forEach(row => {
    const gi = parseInt(row.dataset.group);
    const g = GROUPS[gi];
    const storeMatch = activeStore === 'all' || g.stores.includes(activeStore);
    const catMatch = activeCat === 'all' || g.category === activeCat;
    const winnerMatch = activeWinner === 'all' || g.winner === activeWinner;
    let textMatch = true;
    if (q) {
      const hay = g.entries.map(e => (e.title + ' ' + e.brand + ' ' + (STORES[e.store]||{}).name + ' ' + (STORES[e.store]||{}).badge + ' ' + e.priceDisplay).toLowerCase()).join(' ');
      textMatch = hay.includes(q);
    }
    const show = storeMatch && catMatch && textMatch && winnerMatch;
    row.style.display = show ? '' : 'none';
    // Also hide/show the detail
    const det = document.getElementById('detail-' + gi);
    if (det && !show) det.style.display = 'none';
    else if (det && show && det.classList.contains('open')) det.style.display = 'block';
    if (show) visible++;
  });

  // Hide empty categories
  document.querySelectorAll('.cat').forEach(sec => {
    const anyVisible = Array.from(sec.querySelectorAll('.row[data-group]')).some(r => r.style.display !== 'none');
    sec.style.display = anyVisible ? '' : 'none';
  });

  searchCount.textContent = (q || activeStore !== 'all' || activeCat !== 'all' || activeWinner !== 'all') ? visible + ' items shown' : '';
}

searchInput.addEventListener('input', doFilter);
clearBtn.addEventListener('click', () => { searchInput.value = ''; doFilter(); searchInput.focus(); });

// Store filters
document.getElementById('storeFilters').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  activeStore = e.target.dataset.store;
  document.querySelectorAll('#storeFilters button').forEach(b => {
    b.classList.toggle('active', b.dataset.store === activeStore);
  });
  doFilter();
});

// Winner filters
document.getElementById('winnerFilters').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  activeWinner = e.target.dataset.winner;
  document.querySelectorAll('#winnerFilters button').forEach(b => {
    b.classList.toggle('active', b.dataset.winner === activeWinner);
  });
  doFilter();
});

// Category filters
document.getElementById('catFilters').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  activeCat = e.target.dataset.cat;
  document.querySelectorAll('#catFilters button').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === activeCat);
  });
  doFilter();
});

// Cart functions
function toggleCart(groupIdx, store, checked) {
  const key = groupIdx + '|' + store;
  if (checked) {
    cart[key] = { groupIdx, store, qty: 1, gotten: false };
  } else {
    delete cart[key];
  }
  saveCart();
  updateCartUI();
  // Highlight row
  const row = document.querySelector('.row[data-group="' + groupIdx + '"]');
  if (row) {
    const anyInCart = Object.keys(cart).some(k => k.startsWith(groupIdx + '|'));
    row.classList.toggle('in-cart', anyInCart);
  }
}

function updateCartUI() {
  const keys = Object.keys(cart);
  const btn = document.getElementById('cartBtn');
  const count = document.getElementById('cartBtnCount');
  btn.style.display = keys.length > 0 ? 'flex' : 'none';
  count.textContent = keys.length;

  const gotten = keys.filter(k => cart[k].gotten).length;
  const progress = document.getElementById('cartProgress');
  const progressText = document.getElementById('cartProgressText');
  const progressFill = document.getElementById('cartProgressFill');
  progress.style.display = keys.length > 0 ? 'block' : 'none';
  progressText.textContent = gotten + ' of ' + keys.length + ' items gotten';
  progressFill.style.width = keys.length > 0 ? (gotten / keys.length * 100) + '%' : '0%';

  // Build cart body
  const body = document.getElementById('cartBody');
  if (keys.length === 0) {
    body.innerHTML = '<div class="cart-empty">Check items from the comparison to build your list!</div>';
    return;
  }

  const byStore = {};
  keys.forEach(key => {
    const c = cart[key];
    const g = GROUPS[c.groupIdx];
    if (!g) return;
    const entry = g.entries.find(e => e.store === c.store);
    if (!entry) return;
    if (!byStore[c.store]) byStore[c.store] = [];
    byStore[c.store].push({ ...entry, _key: key, _qty: c.qty, _gotten: c.gotten, _title: g.displayTitle });
  });

  let html = '';
  for (const [sid, items] of Object.entries(byStore)) {
    const s = STORES[sid];
    html += '<div class="cart-store-header" style="background:' + s.color + '">' + s.name + ' (' + items.length + ')</div>';
    items.forEach(item => {
      const gc = item._gotten ? ' got' : '';
      html += '<div class="cart-item' + gc + '">';
      html += '<input type="checkbox" ' + (item._gotten ? 'checked' : '') + ' onchange="markGotten(\\'' + item._key + '\\',this.checked)">';
      html += '<span class="ci-name">' + item._title + '</span>';
      html += '<input class="ci-qty" type="number" min="1" value="' + (item._qty || 1) + '" onchange="setQty(\\'' + item._key + '\\',this.value)">';
      html += '<span class="ci-price" style="color:' + s.color + '">' + item.priceDisplay + '</span>';
      html += '<button class="ci-remove" onclick="removeFromCart(\\'' + item._key + '\\')">\\u00D7</button>';
      html += '</div>';
    });
  }
  body.innerHTML = html;
}

function markGotten(key, val) { if (cart[key]) { cart[key].gotten = val; saveCart(); updateCartUI(); } }
function setQty(key, val) { if (cart[key]) { cart[key].qty = Math.max(1, parseInt(val) || 1); saveCart(); } }
function removeFromCart(key) {
  const c = cart[key];
  if (c) {
    const cb = document.getElementById('cb-' + c.groupIdx + '-' + c.store);
    if (cb) cb.checked = false;
    const row = document.querySelector('.row[data-group="' + c.groupIdx + '"]');
    if (row) {
      delete cart[key];
      const anyInCart = Object.keys(cart).some(k => k.startsWith(c.groupIdx + '|'));
      row.classList.toggle('in-cart', anyInCart);
    }
  }
  delete cart[key];
  saveCart();
  updateCartUI();
}

function openCart() {
  updateCartUI();
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartPanel').classList.add('open');
}
function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartPanel').classList.remove('open');
}

function copyList() {
  const keys = Object.keys(cart);
  if (!keys.length) return;
  const byStore = {};
  keys.forEach(key => {
    const c = cart[key];
    const g = GROUPS[c.groupIdx];
    if (!g) return;
    const entry = g.entries.find(e => e.store === c.store);
    if (!entry) return;
    if (!byStore[c.store]) byStore[c.store] = [];
    byStore[c.store].push({ title: g.displayTitle, price: entry.priceDisplay, qty: c.qty });
  });
  let text = 'Pesach 2026 Shopping List\\n========================\\n';
  for (const [sid, entries] of Object.entries(byStore)) {
    text += '\\n' + STORES[sid].name + ':\\n';
    entries.forEach(e => {
      text += '  [ ] ' + (e.qty > 1 ? e.qty + 'x ' : '') + e.title + ' - ' + e.price + '\\n';
    });
  }
  navigator.clipboard.writeText(text).then(() => alert('Shopping list copied!')).catch(() => {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('Copied!');
  });
}

function uncheckAll() {
  for (const key in cart) { cart[key].gotten = false; }
  saveCart(); updateCartUI();
}

function clearCart() {
  if (!confirm('Clear entire shopping list?')) return;
  // Uncheck all checkboxes
  for (const key in cart) {
    const c = cart[key];
    const cb = document.getElementById('cb-' + c.groupIdx + '-' + c.store);
    if (cb) cb.checked = false;
  }
  document.querySelectorAll('.row.in-cart').forEach(r => r.classList.remove('in-cart'));
  cart = {};
  saveCart(); updateCartUI();
}

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('cartPanel').classList.contains('open')) closeCart();
    else { searchInput.value = ''; doFilter(); }
  }
});

// Init: restore cart checkboxes
function initCart() {
  for (const key in cart) {
    const c = cart[key];
    const cb = document.getElementById('cb-' + c.groupIdx + '-' + c.store);
    if (cb) cb.checked = true;
    const row = document.querySelector('.row[data-group="' + c.groupIdx + '"]');
    if (row) row.classList.add('in-cart');
  }
  updateCartUI();
}
initCart();

async function submitContact() {
  const btn = document.getElementById('cfSubmit');
  const msg = document.getElementById('cfMsg');
  const message = document.getElementById('cfMessage').value.trim();
  if (!message) { msg.textContent = 'Please enter a message.'; msg.style.color = '#dc2626'; return; }
  btn.disabled = true;
  msg.textContent = 'Sending...';
  msg.style.color = '#6366f1';
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: document.getElementById('cfType').value,
        name: document.getElementById('cfName').value,
        email: document.getElementById('cfEmail').value,
        message: message,
      }),
    });
    if (res.ok) {
      msg.textContent = 'Thank you! Your submission has been received.';
      msg.style.color = '#16a34a';
      document.getElementById('cfMessage').value = '';
      document.getElementById('cfName').value = '';
      document.getElementById('cfEmail').value = '';
      setTimeout(() => document.getElementById('contactModal').classList.remove('open'), 2000);
    } else {
      throw new Error('Server error');
    }
  } catch (e) {
    console.error('Contact form error:', e);
    msg.textContent = 'Failed to send. Please try again.';
    msg.style.color = '#dc2626';
    btn.disabled = false;
  }
}
</script>
</body>
</html>`;
}

console.log('index.html generated successfully!');
