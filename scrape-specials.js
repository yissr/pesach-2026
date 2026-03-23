// APPROACH: Paste this into your browser console on the Gourmet Glatt specials page
// It will auto-scroll, capture all API responses, and download a CSV

const SCRIPT = `
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

  // Capture items already on page (first page loaded before hooks)
  console.log('Capturing pre-loaded items...');
  try {
    const scripts = document.querySelectorAll('script[type="application/json"]');
    scripts.forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        if (d.specials) { allSpecials.push(...d.specials); totalExpected = d.total || totalExpected; }
      } catch(e) {}
    });
  } catch(e) {}

  // Scroll to top to re-trigger first page
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
    return { title: name, brand, saleDescription: s.description || '', promotionTag: saleTag, saleStart: (s.startDate||'').split('T')[0], saleEnd: (s.endDate||'').split('T')[0], regularPrice };
  });

  // Download CSV
  const csvHeader = 'Title,Brand,Sale Description,Promotion Tag,Sale Start,Sale End,Regular Price';
  const csvRows = items.map(i =>
    [i.title, i.brand, i.saleDescription, i.promotionTag, i.saleStart, i.saleEnd, i.regularPrice]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"')
      .join(',')
  );
  const csv = '\\uFEFF' + [csvHeader, ...csvRows].join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pesach-specials.csv';
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
`;

console.log('='.repeat(60));
console.log('INSTRUCTIONS:');
console.log('='.repeat(60));
console.log('');
console.log('1. Open Chrome and go to:');
console.log('   https://www.gourmetglattonline.com/specials?filters=%7B%22category%22:%5B93754%5D%7D');
console.log('');
console.log('2. Select the Lakewood store if prompted');
console.log('');
console.log('3. Press F12 to open DevTools > Console tab');
console.log('');
console.log('4. Paste the following script and press Enter:');
console.log('');
console.log(SCRIPT);
console.log('');
console.log('5. Wait for it to auto-scroll and download the CSV file');
console.log('');
console.log('='.repeat(60));

// Also save the script to a file for easy copy-paste
const fs = require('fs');
fs.writeFileSync('browser-script.js', SCRIPT);
console.log('\nScript also saved to: browser-script.js');
console.log('You can open that file and copy its contents.');
