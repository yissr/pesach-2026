// STEP 1: Run this first on the Evergreen specials page
// It will capture one API response and log the full item structure
// so we can see where size/weight data lives

(async () => {
  const captured = [];

  const origFetch = window.fetch;
  window.fetch = async function() {
    const response = await origFetch.apply(this, arguments);
    const url = typeof arguments[0] === 'string' ? arguments[0] : arguments[0]?.url;
    if (url && url.includes('/specials') && url.includes('appId') && !url.includes('/filters')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data.specials && Array.isArray(data.specials)) {
          captured.push(...data.specials);
          // Log first 3 full items to see structure
          console.log('=== FULL ITEM STRUCTURE (first 3) ===');
          data.specials.slice(0, 3).forEach((s, i) => {
            console.log('--- Item ' + i + ' ---');
            console.log(JSON.stringify(s, null, 2));
            // Also specifically look for size-related fields
            const item = s.item || {};
            console.log('item keys:', Object.keys(item));
            console.log('item.size:', item.size);
            console.log('item.weight:', item.weight);
            console.log('item.unitOfMeasure:', item.unitOfMeasure);
            console.log('item.uom:', item.uom);
            console.log('item.description:', item.description);
            console.log('item.names:', JSON.stringify(item.names));
            if (item.brand) console.log('item.brand:', JSON.stringify(item.brand));
          });
        }
      } catch(e) { console.error(e); }
    }
    return response;
  };

  // Also hook XHR
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
            console.log('=== XHR: FULL ITEM STRUCTURE (first 3) ===');
            data.specials.slice(0, 3).forEach((s, i) => {
              console.log('--- Item ' + i + ' ---');
              console.log(JSON.stringify(s, null, 2));
              const item = s.item || {};
              console.log('item keys:', Object.keys(item));
              console.log('item.size:', item.size);
              console.log('item.weight:', item.weight);
            });
          }
        } catch(e) {}
      }
    });
    return origSend.apply(this, arguments);
  };

  console.log('Debug hooks installed. Scroll down to trigger a new page load, then check the console output.');
  alert('Debug hooks installed! Scroll down to load more items, then check the browser console (F12) for the full item structure. Copy-paste the output back to me.');
})();
