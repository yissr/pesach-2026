(async () => {
  const allSpecials = [];
  let totalExpected = 0;

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

  const seen = new Set();
  const unique = allSpecials.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  console.log('Total unique: ' + unique.length);

  // Helper to extract name from the names object
  function getName(namesObj) {
    if (!namesObj) return '';
    // namesObj could be like { "2": { id: 123, name: "Product Name" } }
    // or { "2": "Product Name" }
    const val = namesObj['2'] || namesObj['1'] || Object.values(namesObj)[0];
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.name || val.description || JSON.stringify(val);
    return String(val);
  }

  const items = unique.map(s => {
    const item = s.item || {};
    const name = getName(item.names);
    const brandNames = item.brand?.names;
    const brand = brandNames ? (typeof brandNames === 'string' ? brandNames : (brandNames['2'] || brandNames['1'] || '')) : '';
    const prices = item.prices || [];
    const regularPrice = prices[0]?.unitPrice ?? prices[0]?.regularPrice ?? '';
    const saleTag = s.names?.['2']?.promotionTag || s.names?.['2']?.name || (typeof s.names?.['2'] === 'string' ? s.names['2'] : '') || s.description || '';
    return { title: name, brand, saleDescription: s.description || '', promotionTag: saleTag, saleStart: (s.startDate||'').split('T')[0], saleEnd: (s.endDate||'').split('T')[0], regularPrice };
  });

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

  // Also save raw JSON for debugging
  const rawBlob = new Blob([JSON.stringify(unique.slice(0, 3), null, 2)], { type: 'application/json' });
  const rawUrl = URL.createObjectURL(rawBlob);
  const a2 = document.createElement('a');
  a2.href = rawUrl;
  a2.download = 'pesach-specials-sample-raw.json';
  a2.click();
  URL.revokeObjectURL(rawUrl);

  console.log('Done! CSV downloaded.');
  alert('Done! ' + unique.length + ' Pesach specials downloaded as CSV. Also downloaded a raw JSON sample for debugging.');
})();
