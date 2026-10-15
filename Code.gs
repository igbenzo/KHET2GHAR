// Khet2Ghar - Google Sheets backend (optional). Paste into Extensions > Apps Script of a Google Sheet,
// then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
// Copy the Web app URL into CONFIG.scriptUrl in script.js.
const SHEETS = {
  Farmers: ['ID', 'Full Name', 'Phone', 'Address', 'Bank / UPI', 'Registered On', 'Username', 'Salt', 'Password Hash'],
  Buyers:  ['ID', 'Full Name / Company', 'Phone', 'Delivery Address', 'GSTIN', 'Payment Method', 'Registered On', 'Username', 'Salt', 'Password Hash'],
  Crops:   ['ID', 'Farmer ID', 'Farmer Name', 'Crop', 'Category', 'Price (Rs/kg)', 'Quantity (kg)', 'Location', 'Listed On'],
  Orders:  ['ID', 'Buyer ID', 'Buyer Name', 'Crop ID', 'Crop', 'Farmer ID', 'Quantity (kg)', 'Total (Rs)', 'Payment', 'Status', 'Ordered On']
};
const TESTER = { user: 'MARCOS', name: 'Marcos (Tester)', salt: 'k2g-tester-salt-7f3a', hash: '68d3e67e624d307daea8a7e2a10228f179bb0270ad2c2a5ee71489b128935b1e' };

function doGet() { return out({ ok: true, message: 'Khet2Ghar backend is running.' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const req = JSON.parse(e.postData.contents);
    ensureTester();
    const fn = ACTIONS[req.action];
    return out(fn ? fn(req) : bad('Unknown action.'));
  } catch (err) {
    return out(bad('Server error: ' + err));
  } finally {
    lock.releaseLock();
  }
}

const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const bad = (message) => ({ ok: false, message: message });
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const stamp = () => Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
const sha = (pw, salt) => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw, Utilities.Charset.UTF_8)
  .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

function table(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f5130');
    sh.setFrozenRows(1);
  }
  return sh;
}
function rows(name) {
  const sh = table(name), h = SHEETS[name], n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, h.length).getValues().map((r, i) => {
    const o = { _row: i + 2 };
    h.forEach((k, j) => (o[k] = r[j]));
    return o;
  });
}
function add(name, obj) {
  const sh = table(name), row = SHEETS[name].map((k) => (obj[k] === undefined ? '' : obj[k]));
  const range = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
}
const nextId = (name, p) => p + String(table(name).getLastRow()).padStart(4, '0'); // header counts as 1

function ensureTester() {
  if (rows('Farmers').some((u) => u.Username === TESTER.user)) return;
  const auth = { Username: TESTER.user, Salt: TESTER.salt, 'Password Hash': TESTER.hash };
  add('Farmers', Object.assign({ ID: nextId('Farmers', 'F'), 'Full Name': TESTER.name, 'Registered On': stamp() }, auth));
  add('Buyers', Object.assign({ ID: nextId('Buyers', 'B'), 'Full Name / Company': TESTER.name, 'Payment Method': 'UPI', 'Registered On': stamp() }, auth));
}

const ACTIONS = {
  register: (d) => {
    const farmer = d.role === 'farmer', phone = clean(d.phone), username = clean(d.username);
    if (!clean(d.name) || !/^\d{10}$/.test(phone) || !clean(d.address)) return bad('Name, a 10-digit phone number and address are required.');
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(username)) return bad('Username must be 3-20 letters, numbers, dot or underscore.');
    if (String(d.password || '').length < 6) return bad('Password must be at least 6 characters.');
    const all = rows('Farmers').concat(rows('Buyers'));
    if (all.some((u) => String(u.Username).toLowerCase() === username.toLowerCase())) return bad('This username is already taken.');
    if (all.some((u) => String(u.Phone) === phone)) return bad('This phone number is already registered.');
    const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    const auth = { Username: username, Salt: salt, 'Password Hash': sha(String(d.password), salt), 'Registered On': stamp() };
    const name = farmer ? 'Farmers' : 'Buyers', id = nextId(name, farmer ? 'F' : 'B');
    add(name, farmer
      ? Object.assign({ ID: id, 'Full Name': clean(d.name), Phone: phone, Address: clean(d.address), 'Bank / UPI': clean(d.bank) }, auth)
      : Object.assign({ ID: id, 'Full Name / Company': clean(d.name), Phone: phone, 'Delivery Address': clean(d.address), GSTIN: clean(d.gstin), 'Payment Method': clean(d.payment) }, auth));
    return { ok: true, id: id, name: clean(d.name) };
  },
  login: (d) => {
    const un = clean(d.username).toLowerCase();
    const find = (n) => rows(n).find((u) => String(u.Username).toLowerCase() === un);
    const f = find('Farmers'), b = find('Buyers'), acc = f || b;
    if (!acc || sha(String(d.password || ''), String(acc.Salt)) !== acc['Password Hash']) return bad('Wrong username or password.');
    if (un === TESTER.user.toLowerCase()) return { ok: true, id: f.ID, farmerId: f.ID, buyerId: b.ID, name: TESTER.name, role: 'tester' };
    return { ok: true, id: acc.ID, name: acc['Full Name'] || acc['Full Name / Company'], role: f ? 'farmer' : 'buyer' };
  },
  crops: () => rows('Crops').filter((c) => Number(c['Quantity (kg)']) > 0).map((c) => {
    delete c._row; c['Price (Rs/kg)'] = Number(c['Price (Rs/kg)']); c['Quantity (kg)'] = Number(c['Quantity (kg)']); return c;
  }),
  addCrop: (d) => {
    const price = Number(d.price), qty = Number(d.quantity);
    if (!clean(d.crop) || !(price > 0) || !(qty > 0)) return bad('Crop name, price and quantity are required.');
    const farmer = rows('Farmers').find((f) => f.ID === clean(d.farmerId).toUpperCase());
    if (!farmer) return bad('Farmer ID not found. Please register or log in first.');
    const id = nextId('Crops', 'C');
    add('Crops', { ID: id, 'Farmer ID': farmer.ID, 'Farmer Name': farmer['Full Name'], Crop: clean(d.crop), Category: clean(d.category), 'Price (Rs/kg)': price, 'Quantity (kg)': qty, Location: clean(d.location) || farmer.Address || '', 'Listed On': stamp() });
    return { ok: true, id: id };
  },
  order: (d) => {
    const qty = Number(d.quantity);
    if (!(qty > 0)) return bad('Enter a valid quantity.');
    const buyer = rows('Buyers').find((b) => b.ID === clean(d.buyerId).toUpperCase());
    if (!buyer) return bad('Buyer ID not found. Please register or log in first.');
    const crop = rows('Crops').find((c) => c.ID === d.cropId);
    if (!crop) return bad('This listing is no longer available.');
    const stock = Number(crop['Quantity (kg)']);
    if (qty > stock) return bad('Only ' + stock + ' kg available.');
    const cell = table('Crops').getRange(crop._row, SHEETS.Crops.indexOf('Quantity (kg)') + 1);
    cell.setNumberFormat('@'); cell.setValue(stock - qty);
    const total = qty * Number(crop['Price (Rs/kg)']), id = nextId('Orders', 'O');
    add('Orders', { ID: id, 'Buyer ID': buyer.ID, 'Buyer Name': buyer['Full Name / Company'], 'Crop ID': crop.ID, Crop: crop.Crop, 'Farmer ID': crop['Farmer ID'], 'Quantity (kg)': qty, 'Total (Rs)': total, Payment: buyer['Payment Method'] || 'UPI', Status: 'Confirmed', 'Ordered On': stamp() });
    return { ok: true, id: id, total: total };
  }
};
