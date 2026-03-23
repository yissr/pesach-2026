const fs = require('fs');
const d = JSON.parse(fs.readFileSync('npgs-specials.json', 'utf8'));

const newItems = [
  { title: "Handmade Matzoh Shmura", brand: "Gefen", saleDescription: "Only $45.99", promotionTag: "Only $45.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "18 Minute Matzah 16 Oz", brand: "Geula", saleDescription: "Only $7.59", promotionTag: "Only $7.59", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "18 Minutes Matzos Baked in Jerusalem 16 Oz", brand: "Haddar", saleDescription: "Only $6.69", promotionTag: "Only $6.69", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Passover Egg Matzos 10.5 Oz", brand: "Haddar", saleDescription: "Only $5.99", promotionTag: "Only $5.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Shmura Matzos 16 Oz", brand: "Haddar", saleDescription: "Only $10.79", promotionTag: "Only $10.79", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Whole Wheat Shmura Matzos 16 Oz", brand: "Haddar", saleDescription: "Only $10.79", promotionTag: "Only $10.79", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Passover Hand Matzos", brand: "Kerestir", saleDescription: "Only $47.49", promotionTag: "Only $47.49", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Hand Shmura Matza Meal 1 lb", brand: "NPGS", saleDescription: "Only $16.99", promotionTag: "Only $16.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Egg Matzos 12 Oz", brand: "Streit's", saleDescription: "Only $4.19", promotionTag: "Only $4.19", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Passover Hand Matzos 2 lb", brand: "", saleDescription: "Only $91.98", promotionTag: "Only $91.98", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Gluten Free Oat Matzos 5.3 Oz", brand: "", saleDescription: "Only $43.99", promotionTag: "Only $43.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Organic Spelt Shmura Matzoh 1 lb", brand: "", saleDescription: "Only $42.99", promotionTag: "Only $42.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Shmura Matza 2 lb", brand: "NPGS", saleDescription: "Only $49.98", promotionTag: "Only $49.98", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Shmura Matza 1 lb", brand: "NPGS", saleDescription: "Only $24.99", promotionTag: "Only $24.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Whole Wheat Shmura Matza 1 lb", brand: "NPGS", saleDescription: "Only $27.49", promotionTag: "Only $27.49", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Whole Wheat Shmura Matza 2 lb", brand: "NPGS", saleDescription: "Only $54.98", promotionTag: "Only $54.98", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Kerestir Matzoh Shmura", brand: "Kerestir", saleDescription: "Only $94.99", promotionTag: "Only $94.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
  { title: "Hand Made Organic Shmurah Oat Matzah 3 pcs", brand: "Matot Charlop", saleDescription: "Only $34.99", promotionTag: "Only $34.99", saleStart: "", saleEnd: "2026-04-08", regularPrice: "" },
];

// Skip if already exists
const existing = new Set(d.map(i => i.title.toLowerCase().trim()));
let added = 0;
newItems.forEach(item => {
  if (!existing.has(item.title.toLowerCase().trim())) {
    d.push(item);
    added++;
  } else {
    console.log('Skipped (exists):', item.title);
  }
});

console.log('Added ' + added + ' matzah items. Total:', d.length);
fs.writeFileSync('npgs-specials.json', JSON.stringify(d, null, 2));
