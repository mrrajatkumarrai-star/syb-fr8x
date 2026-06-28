const fs = require('fs');
const html = fs.readFileSync('freight_erp_full.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (m) {
  try {
    new Function(m[1]);
    console.log('JS syntax OK');
  } catch(e) {
    console.log('SYNTAX ERROR:', e.message);
  }
} else {
  console.log('No script tag found');
}
