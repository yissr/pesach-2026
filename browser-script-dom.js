
(async () => {
  // Auto-scroll to load all items first
  console.log('Starting auto-scroll to load all items...');
  let noNew = 0;
  let lastCount = 0;

  while (noNew < 15) {
    const currentCount = document.querySelectorAll('.name').length;
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1500));

    if (currentCount === lastCount) {
      noNew++;
    } else {
      noNew = 0;
      lastCount = currentCount;
    }
    console.log('Items on page: ' + currentCount + ' (idle: ' + noNew + '/15)');
  }

  console.log('Scroll complete. Scraping DOM...');

  // Find all product cards by looking for .name elements and walking up to the card
  const nameEls = document.querySelectorAll('.name');
  console.log('Found ' + nameEls.length + ' .name elements');

  // Log the first card's structure so we can see what's available
  if (nameEls.length > 0) {
    const firstCard = nameEls[0].closest('[class*="special"], [class*="product"], [class*="item"], li, article, div[class]');
    if (firstCard) {
      console.log('First card HTML sample:', firstCard.innerHTML.substring(0, 500));
      console.log('First card classes:', firstCard.className);
    }
    // Also log parent structure
    let el = nameEls[0];
    let path = [];
    for (let i = 0; i < 8 && el; i++) {
      path.push(el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : ''));
      el = el.parentElement;
    }
    console.log('DOM path from .name:', path.join(' → '));
  }

  const items = [];
  const seen = new Set();

  nameEls.forEach(el => {
    const name = el.textContent.trim();
    if (!name) return;

    // Walk up to find the product card container
    let card = el.closest('[class*="special"], [class*="product"], [class*="item"], li, article') || el.parentElement?.parentElement?.parentElement;
    if (!card) card = el.parentElement;

    // Try multiple selectors for each field
    const getText = (selectors) => {
      for (const sel of selectors) {
        const found = card.querySelector(sel);
        if (found && found.textContent.trim()) return found.textContent.trim();
      }
      return '';
    };

    const brand = getText(['.brand', '[class*="brand"]', '.manufacturer']);
    const promo = getText(['.promotion-tag', '[class*="promo"]', '[class*="tag"]', '.description', '[class*="sale"]', '[class*="discount"]', '[class*="special-name"]', '[class*="offer"]']);
    const price = getText(['.price', '[class*="price"]', '[class*="cost"]', '[class*="amount"]']);
    const saleEnd = getText(['.date', '[class*="date"]', '[class*="end"]', '[class*="valid"]', '[class*="expire"]']);

    // Build a dedup key
    const key = name + '|' + promo + '|' + price;
    if (seen.has(key)) return;
    seen.add(key);

    // Try to extract image
    const imgEl = card.querySelector('img');
    const image = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';

    items.push({
      title: name,
      brand: brand,
      saleDescription: promo || price,
      promotionTag: promo || price,
      saleStart: '',
      saleEnd: saleEnd,
      regularPrice: '',
      image: image
    });
  });

  console.log('Scraped ' + items.length + ' unique items');
  if (items.length > 0) {
    console.log('Sample items:', JSON.stringify(items.slice(0, 3), null, 2));
  }

  if (items.length === 0) {
    // Fallback: try to find ANY text content in cards
    console.log('No items found via .name. Trying fallback selectors...');
    const allDivs = document.querySelectorAll('div[class]');
    const classCounts = {};
    allDivs.forEach(d => {
      d.className.split(' ').forEach(c => {
        if (c) classCounts[c] = (classCounts[c] || 0) + 1;
      });
    });
    // Show classes that appear 100+ times (likely card elements)
    const frequent = Object.entries(classCounts).filter(([k,v]) => v > 50).sort((a,b) => b[1]-a[1]);
    console.log('Frequent CSS classes (50+):', frequent.slice(0, 30));
    alert('No items scraped. Check console for DOM structure info.');
    return;
  }

  // Download CSV
  const csvHeader = 'Title,Brand,Sale Description,Promotion Tag,Sale Start,Sale End,Regular Price';
  const csvRows = items.map(i =>
    [i.title, i.brand, i.saleDescription, i.promotionTag, i.saleStart, i.saleEnd, i.regularPrice]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"')
      .join(',')
  );
  const csv = '\uFEFF' + [csvHeader, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pesach-specials.csv';
  a.click();
  URL.revokeObjectURL(url);

  // Try clipboard
  const json = JSON.stringify(items, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    console.log('JSON also copied to clipboard.');
  } catch(e) {
    console.log('Clipboard copy skipped (tab not focused). CSV file was saved.');
  }

  console.log('Done! CSV downloaded.');
  alert('Done! ' + items.length + ' items scraped. CSV downloaded.');
})();
