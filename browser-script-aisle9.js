
(async () => {
  const allItems = [];
  const seen = new Set();

  function scrapeCurrentPage() {
    const cards = document.querySelectorAll('.product-item-content');
    let newCount = 0;
    cards.forEach(card => {
      const titleEl = card.querySelector('p.product-item-title');
      const priceEl = card.querySelector('p.product-item-price');
      const oldPriceEl = card.querySelector('p.product-item-old-price');

      const title = titleEl ? (titleEl.getAttribute('title') || titleEl.textContent.trim()) : '';
      if (!title) return;

      const price = priceEl ? priceEl.textContent.trim() : '';
      const oldPrice = oldPriceEl ? oldPriceEl.textContent.trim() : '';

      // Parse sale price — extract just the dollar amount
      const saleMatch = price.match(/\$([\d.]+)/);
      const salePrice = saleMatch ? '$' + saleMatch[1] : price;

      const key = title + '|' + salePrice;
      if (seen.has(key)) return;
      seen.add(key);

      allItems.push({
        title: title,
        brand: '',
        saleDescription: 'Only ' + salePrice,
        promotionTag: 'Only ' + salePrice,
        saleStart: '',
        saleEnd: '',
        regularPrice: oldPrice
      });
      newCount++;
    });
    return newCount;
  }

  // Scroll within virtual list to load all items on current page
  async function scrollVirtualList() {
    let noNew = 0;
    let lastCount = 0;

    while (noNew < 10) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 800));

      const currentCount = document.querySelectorAll('.product-item-content').length;
      if (currentCount === lastCount) {
        noNew++;
      } else {
        noNew = 0;
        lastCount = currentCount;
      }
    }
    // Scroll back to top to ensure all virtualized items render
    // Scrape at multiple scroll positions
    const totalHeight = document.body.scrollHeight;
    const step = window.innerHeight;
    for (let pos = 0; pos <= totalHeight; pos += step) {
      window.scrollTo(0, pos);
      await new Promise(r => setTimeout(r, 300));
      scrapeCurrentPage();
    }
  }

  // Find pagination buttons
  function getPageButtons() {
    // Look for page number links/buttons
    const btns = [];
    document.querySelectorAll('button, a').forEach(el => {
      const txt = el.textContent.trim();
      if (/^\d+$/.test(txt) && parseInt(txt) >= 1 && parseInt(txt) <= 50) {
        // Check if it's in a pagination area
        const parent = el.closest('nav, [class*="paginat"], [class*="pager"], ul');
        if (parent || el.className.includes('page') || el.parentElement?.className.includes('page')) {
          btns.push({ num: parseInt(txt), el: el });
        }
      }
    });
    // Also try: elements near the > (next) button
    if (btns.length === 0) {
      const arrows = document.querySelectorAll('[class*="pagination"], [class*="pager"]');
      arrows.forEach(container => {
        container.querySelectorAll('button, a, span').forEach(el => {
          const txt = el.textContent.trim();
          if (/^\d+$/.test(txt)) {
            btns.push({ num: parseInt(txt), el: el });
          }
        });
      });
    }
    return btns.sort((a, b) => a.num - b.num);
  }

  // Try to find the "next" button
  function getNextButton() {
    const candidates = document.querySelectorAll('button, a');
    for (const el of candidates) {
      if (el.textContent.trim() === '>' || el.textContent.trim() === '›' ||
          el.getAttribute('aria-label')?.includes('next') ||
          el.className.includes('next')) {
        return el;
      }
    }
    return null;
  }

  console.log('=== Aisle 9 Market Scraper ===');

  // First, scrape page 1
  console.log('Scraping page 1...');
  await scrollVirtualList();
  console.log('After page 1: ' + allItems.length + ' items');

  // Try to navigate through remaining pages
  let pageNum = 1;
  const maxPages = 20;

  while (pageNum < maxPages) {
    const nextBtn = getNextButton();
    if (!nextBtn) {
      console.log('No next button found. Done with pagination.');
      break;
    }

    // Check if next button is disabled
    if (nextBtn.disabled || nextBtn.classList.contains('disabled') || nextBtn.getAttribute('aria-disabled') === 'true') {
      console.log('Next button is disabled. Last page reached.');
      break;
    }

    pageNum++;
    console.log('Clicking to page ' + pageNum + '...');
    nextBtn.click();
    await new Promise(r => setTimeout(r, 2000)); // Wait for page to load

    await scrollVirtualList();
    console.log('After page ' + pageNum + ': ' + allItems.length + ' total items');
  }

  console.log('=== DONE === Total unique items: ' + allItems.length);

  if (allItems.length === 0) {
    alert('No items found! Check console.');
    return;
  }

  // Download CSV
  const csvHeader = 'Title,Brand,Sale Description,Promotion Tag,Sale Start,Sale End,Regular Price';
  const csvRows = allItems.map(i =>
    [i.title, i.brand, i.saleDescription, i.promotionTag, i.saleStart, i.saleEnd, i.regularPrice]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"')
      .join(',')
  );
  const csv = '\uFEFF' + [csvHeader, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aisle9-specials.csv';
  a.click();
  URL.revokeObjectURL(url);

  try {
    await navigator.clipboard.writeText(JSON.stringify(allItems, null, 2));
    console.log('JSON copied to clipboard.');
  } catch(e) {
    console.log('Clipboard skipped. CSV saved.');
  }

  alert('Done! ' + allItems.length + ' items scraped from ' + pageNum + ' pages. CSV downloaded as aisle9-specials.csv');
})();
