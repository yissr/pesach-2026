
(async () => {
  const allSpecials = [];
  let totalExpected = 0;

  // Hook into XMLHttpRequest to capture API responses
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this._url && this._url.includes('/specials') && this._url.includes('appId') && !this._url.includes('/filters')) {
        try {
          const data = JSON.parse(this.responseText);
          if (data.specials && Array.isArray(data.specials)) {
            allSpecials.push(...data.specials);
            totalExpected = data.total || totalExpected;
            console.log('Captured ' + allSpecials.length + ' / ' + totalExpected);
          }
        } catch(e) {}
      }
    });
    return origSend.apply(this, arguments);
  };

  // Also hook fetch
  const origFetch = window.fetch;
  window.fetch = async function() {
    const response = await origFetch.apply(this, arguments);
    const url = typeof arguments[0] === 'string' ? arguments[0] : arguments[0]?.url;
    if (url && url.includes('/specials') && url.includes('appId') && !url.includes('/filters')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data.specials && Array.isArray(data.specials)) {
          allSpecials.push(...data.specials);
          totalExpected = data.total || totalExpected;
          console.log('Captured ' + allSpecials.length + ' / ' + totalExpected);
        }
      } catch(e) {}
    }
    return response;
  };

  // Capture items already on the page (first page loaded before hooks were set up)
  // Try to find the app's internal data store first
  console.log('Capturing items already on page...');
  try {
    // Look for existing specials data in Angular/React state or window globals
    const existingCards = document.querySelectorAll('.special-item, [class*="special-item"], [class*="product-item"]');
    if (existingCards.length > 0) {
      console.log('Found ' + existingCards.length + ' pre-loaded cards in DOM');
    }
    // Try to find any __NEXT_DATA__ or similar state
    const scripts = document.querySelectorAll('script[type="application/json"]');
    scripts.forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        if (d.specials) { allSpecials.push(...d.specials); totalExpected = d.total || totalExpected; }
      } catch(e) {}
    });
  } catch(e) {}

  // Scroll to top, then trigger a fresh load by scrolling past the first page zone
  console.log('Scrolling to top to re-trigger first page...');
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 2000));

  // Auto-scroll
  console.log('Starting auto-scroll...');
  let noNew = 0;
  let lastCount = 0;

  while (noNew < 25) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1500));

    if (allSpecials.length === lastCount) {
      noNew++;
    } else {
      noNew = 0;
      lastCount = allSpecials.length;
    }

    if (totalExpected > 0 && allSpecials.length >= totalExpected) {
      console.log('All loaded!');
      break;
    }

    if (noNew % 10 === 0 && noNew > 0) {
      console.log('Still scrolling... ' + allSpecials.length + ' items');
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = allSpecials.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  console.log('Total unique: ' + unique.length);

  // Extract data
  const items = unique.map(s => {
    const item = s.item || {};
    const nameObj = item.names?.['2'] || item.names?.['1'] || {};
    const name = typeof nameObj === 'string' ? nameObj : (nameObj.long || nameObj.short || nameObj.name || '');
    const brandObj = item.brand?.names?.['2'] || item.brand?.names?.['1'] || '';
    const brand = typeof brandObj === 'string' ? brandObj : (brandObj.name || brandObj.long || brandObj.short || '');
    const prices = item.prices || [];
    const regularPrice = prices[0]?.unitPrice ?? '';
    const saleTag = s.names?.['2']?.promotionTag || s.names?.['2']?.name || s.description || '';
    const uom = item.unitOfMeasure || '';
    const weight = item.weight || 0;
    const numItems = item.numberOfItems || 0;
    // Build unit name from unitOfMeasure
    let unitName = '';
    if (uom && typeof uom === 'object') {
      const uomName = uom.names?.['2'] || uom.names?.['1'] || '';
      unitName = typeof uomName === 'string' ? uomName : (uomName.long || uomName.short || uomName.name || '');
    } else if (typeof uom === 'string') {
      unitName = uom;
    }
    // Combine quantity with unit
    let size = '';
    const qty = weight || numItems || 0;
    if (qty && unitName) {
      size = qty + ' ' + unitName;
    } else if (qty) {
      size = String(qty);
    } else if (unitName) {
      // Only have unit name, no quantity — try to extract from product name
      const sizeMatch = name.match(/(\d+\.?\d*)\s*(oz|fl\s*oz|lb|lbs|ct|count|pk|pack|ml|l|kg|g|pc|pcs|sq\s*ft|gal|qt|pt)\b/i);
      if (sizeMatch) {
        size = sizeMatch[0];
      } else {
        size = unitName; // fallback to just unit name
      }
    } else {
      // No API size data — extract from product name
      const sizeMatch = name.match(/(\d+\.?\d*)\s*(oz|fl\s*oz|lb|lbs|ct|count|pk|pack|ml|l|kg|g|pc|pcs|sq\s*ft|gal|qt|pt)\b/i);
      if (sizeMatch) size = sizeMatch[0];
    }
    return { title: name, brand, size, saleDescription: s.description || '', promotionTag: saleTag, saleStart: (s.startDate||'').split('T')[0], saleEnd: (s.endDate||'').split('T')[0], regularPrice };
  });

  // Download CSV
  const csvHeader = 'Title,Brand,Size,Sale Description,Promotion Tag,Sale Start,Sale End,Regular Price';
  const csvRows = items.map(i =>
    [i.title, i.brand, i.size, i.saleDescription, i.promotionTag, i.saleStart, i.saleEnd, i.regularPrice]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"')
      .join(',')
  );
  const csv = '\uFEFF' + [csvHeader, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'evergreen-specials.csv';
  a.click();
  URL.revokeObjectURL(url);

  // Also try to copy JSON to clipboard (may fail if tab lost focus)
  const json = JSON.stringify(items, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    console.log('JSON also copied to clipboard.');
  } catch(e) {
    console.log('Clipboard copy skipped (tab not focused). CSV file was saved — use that instead.');
  }

  console.log('Done! CSV downloaded.');
  alert('Done! ' + unique.length + ' Pesach specials downloaded as CSV.');
})();
