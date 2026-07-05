/**
 * Buyurtma paneli — Google Apps Script backend.
 *
 * Jadval sahifalari:
 *  - NARXLANISH : Muddat | Qiymati | Karta_raqami
 *  - BUYURTMA   : Buyurtmachi_FIO | Telefon_raqami | Product_Key | Activation_key | Muddati | Tolov_kartasi | Tolov_vaqti
 *  - LOGIN      : Login | Parol
 */

// ====== Sozlamalar ======
var SHEET_NARXLANISH = 'NARXLANISH';
var SHEET_BUYURTMA = 'BUYURTMA';
var SHEET_LOGIN = 'LOGIN';
var SHEET_MAHSULOT = 'MAHSULOT'; // Mahsulot_nomi | RSA_kalit | Mahsulot_havolasi

// BUYURTMA ustunlari tartibi (1-indeksli)
// A=FIO B=Telefon C=Mahsulot D=Product_Key E=Activation_key F=Muddati G=Tolov_kartasi H=Tolov_vaqti I=Holati
var COL = {
  FIO: 1,
  TELEFON: 2,
  MAHSULOT: 3,
  PRODUCT_KEY: 4,
  ACTIVATION_KEY: 5,
  MUDDATI: 6,
  TOLOV_KARTASI: 7,
  TOLOV_VAQTI: 8,
  HOLATI: 9 // Kutilmoqda | Tasdiqlangan | Rad etilgan (avtomatik qo'shiladi)
};

// BUYURTMA sahifasidagi ustunlar soni
var BUYURTMA_COLS = 9;

// Buyurtma holatlari
var STATUS_PENDING = 'Kutilmoqda';
var STATUS_APPROVED = 'Tasdiqlangan';
var STATUS_REJECTED = 'Rad etilgan';

// RSA litsenziya faqat shu mahsulot uchun avtomatik ishlab chiqiladi.
// Boshqa mahsulotlar uchun admin kalitni qo'lda kiritadi (usullari keyin qo'shiladi).
function isClassifierProduct_(mahsulot) {
  return String(mahsulot || '').toLowerCase().indexOf('klassifikator') !== -1;
}

/**
 * Web-ilovaning kirish nuqtasi.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Buyurtma paneli')
    .setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/spreadsheets_2018q4.ico')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * HTML fayllarni bir-biriga ulash uchun yordamchi (Styles, JavaScript).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ====== Yordamchi funksiyalar ======

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('"' + name + '" sahifasi topilmadi.');
  }
  return sheet;
}

/**
 * Telefon raqamini faqat raqamlarga keltiradi va oxirgi 9 ta raqamni qaytaradi.
 * Masalan: "+998 93 911 30 05" -> "998939113005" -> solishtirish uchun "939113005".
 */
function normalizePhone_(phone) {
  if (phone === null || phone === undefined) return '';
  var digits = String(phone).replace(/\D/g, '');
  // 998 prefiksini olib tashlaymiz (bo'lsa)
  if (digits.length > 9 && digits.indexOf('998') === 0) {
    digits = digits.substring(3);
  }
  return digits;
}

// ====== Autentifikatsiya ======

/**
 * Telefon raqamini tekshiradi. LOGIN sahifasida bo'lsa admin,
 * bo'lmasa oddiy buyurtmachi hisoblanadi.
 * @param {string} phone
 * @return {{ok:boolean, isAdmin:boolean, phone:string, message?:string}}
 */
function checkPhone(phone) {
  var norm = normalizePhone_(phone);
  if (norm.length < 9) {
    return { ok: false, message: 'Telefon raqami noto\'g\'ri kiritilgan.' };
  }

  var sheet = getSheet_(SHEET_LOGIN);
  var lastRow = sheet.getLastRow();
  var isAdmin = false;

  if (lastRow >= 2) {
    var logins = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < logins.length; i++) {
      if (normalizePhone_(logins[i][0]) === norm) {
        isAdmin = true;
        break;
      }
    }
  }

  return { ok: true, isAdmin: isAdmin, phone: norm };
}

/**
 * Admin parolini tekshiradi.
 * @param {string} phone
 * @param {string} password
 * @return {{ok:boolean, message?:string}}
 */
function verifyAdminPassword(phone, password) {
  var norm = normalizePhone_(phone);
  var sheet = getSheet_(SHEET_LOGIN);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { ok: false, message: 'Login ma\'lumotlari topilmadi.' };
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizePhone_(rows[i][0]) === norm) {
      if (String(rows[i][1]) === String(password)) {
        return { ok: true };
      }
      return { ok: false, message: 'Parol noto\'g\'ri.' };
    }
  }
  return { ok: false, message: 'Bunday login topilmadi.' };
}

// ====== Narxlanish ======

/**
 * NARXLANISH sahifasidagi barcha tariflarni qaytaradi.
 * Ustunlar: Mahsulot | Muddat | Qiymati | Karta_raqami
 * @return {Array<{mahsulot:string, muddat:string, qiymati:string, karta:string}>}
 */
function getPricing() {
  var sheet = getSheet_(SHEET_NARXLANISH);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
  var result = [];
  for (var i = 0; i < values.length; i++) {
    // Mahsulot yoki Muddat bo'sh bo'lsa o'tkazib yuboramiz
    if (String(values[i][0]).trim() === '' && String(values[i][1]).trim() === '') continue;
    result.push({
      mahsulot: String(values[i][0]).trim(),
      muddat: String(values[i][1]).trim(),
      qiymati: String(values[i][2]).trim(),
      karta: String(values[i][3]).trim()
    });
  }
  return result;
}

// ====== Buyurtmalar ======

function rowToOrder_(row, rowIndex) {
  return {
    row: rowIndex,
    fio: String(row[COL.FIO - 1]),
    telefon: String(row[COL.TELEFON - 1]),
    mahsulot: String(row[COL.MAHSULOT - 1]),
    productKey: String(row[COL.PRODUCT_KEY - 1]),
    activationKey: String(row[COL.ACTIVATION_KEY - 1]),
    muddati: String(row[COL.MUDDATI - 1]),
    tolovKartasi: String(row[COL.TOLOV_KARTASI - 1]),
    tolovVaqti: String(row[COL.TOLOV_VAQTI - 1]),
    holati: String(row[COL.HOLATI - 1] || '')
  };
}

/**
 * Berilgan telefon raqamiga tegishli buyurtmalarni qaytaradi (eng yangisi birinchi).
 * @param {string} phone
 */
function getUserOrders(phone) {
  var norm = normalizePhone_(phone);
  var sheet = getSheet_(SHEET_BUYURTMA);
  var lastRow = sheet.getLastRow();
  var orders = [];

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, BUYURTMA_COLS).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      if (normalizePhone_(values[i][COL.TELEFON - 1]) === norm) {
        orders.push(rowToOrder_(values[i], i + 2));
      }
    }
  }
  // Eng yangi qatorlar tepada
  orders.reverse();
  return orders;
}

/**
 * Yangi buyurtma qo'shadi.
 * @param {Object} data {phone, fio, productKey, muddati, tolovKartasi, tolovVaqti}
 * @return {{ok:boolean, message?:string}}
 */
function submitOrder(data) {
  try {
    var norm = normalizePhone_(data.phone);
    if (norm.length < 9) {
      return { ok: false, message: 'Telefon raqami noto\'g\'ri.' };
    }

    // Majburiy maydonlarni tekshirish
    var required = {
      'Buyurtmachi FIO': data.fio,
      'Mahsulot': data.mahsulot,
      'Product Key': data.productKey,
      'Muddati': data.muddati,
      'To\'lov kartasi': data.tolovKartasi,
      'To\'lov vaqti': data.tolovVaqti
    };
    for (var key in required) {
      if (!required[key] || String(required[key]).trim() === '') {
        return { ok: false, message: '"' + key + '" maydoni to\'ldirilishi shart.' };
      }
    }

    // Karta raqami — aynan 16 ta raqam bo'lishi shart
    var cardDigits = String(data.tolovKartasi).replace(/\D/g, '');
    if (cardDigits.length !== 16) {
      return { ok: false, message: 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak.' };
    }

    var sheet = getSheet_(SHEET_BUYURTMA);
    ensureHolatiHeader_();
    var newRow = [];
    newRow[COL.FIO - 1] = String(data.fio).trim();
    newRow[COL.TELEFON - 1] = "998" + norm; // to'liq formatda saqlaymiz
    newRow[COL.MAHSULOT - 1] = String(data.mahsulot).trim();
    newRow[COL.PRODUCT_KEY - 1] = String(data.productKey).trim();
    newRow[COL.ACTIVATION_KEY - 1] = ''; // admin tasdiqlaganda to'ladi
    newRow[COL.MUDDATI - 1] = String(data.muddati).trim();
    newRow[COL.TOLOV_KARTASI - 1] = String(data.tolovKartasi).trim();
    newRow[COL.TOLOV_VAQTI - 1] = String(data.tolovVaqti).trim();
    newRow[COL.HOLATI - 1] = STATUS_PENDING;

    sheet.appendRow(newRow);
    return { ok: true, message: 'Buyurtmangiz qabul qilindi! Administrator tasdiqlashini kuting.' };
  } catch (e) {
    return { ok: false, message: 'Xatolik: ' + e.message };
  }
}

// ====== Admin funksiyalari ======

/**
 * Barcha buyurtmalarni qaytaradi (admin paneli uchun).
 */
function getAllOrders() {
  var sheet = getSheet_(SHEET_BUYURTMA);
  var lastRow = sheet.getLastRow();
  var orders = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, BUYURTMA_COLS).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      // Bo'sh qatorlarni o'tkazib yuboramiz
      if (String(values[i][COL.TELEFON - 1]).trim() === '' &&
          String(values[i][COL.FIO - 1]).trim() === '') continue;
      orders.push(rowToOrder_(values[i], i + 2));
    }
  }
  orders.reverse();
  return orders;
}

/**
 * BUYURTMA sahifasida "Holati" (H) ustuni sarlavhasi bo'lmasa qo'shadi.
 */
function ensureHolatiHeader_() {
  var sheet = getSheet_(SHEET_BUYURTMA);
  var cell = sheet.getRange(1, COL.HOLATI);
  if (String(cell.getValue()).trim() === '') {
    cell.setValue('Holati');
  }
}

function normalizeName_(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

/**
 * MAHSULOT sahifasidan berilgan mahsulot uchun RSA maxfiy kalitni (B ustuni) qaytaradi.
 * @param {string} productName
 * @return {string} .NET XML formatidagi RSA maxfiy kalit yoki ''
 */
function getRsaKeyForProduct_(productName) {
  var sheet = getSheet_(SHEET_MAHSULOT);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  var target = normalizeName_(productName);
  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // A=nomi, B=RSA_kalit
  for (var i = 0; i < rows.length; i++) {
    if (normalizeName_(rows[i][0]) === target) {
      return String(rows[i][1] || '').trim();
    }
  }
  return '';
}

/**
 * MAHSULOT sahifasidagi mahsulotlar ro'yxatini (nom + yuklab olish havolasi) qaytaradi.
 * RSA kalit MIJOZGA UZATILMAYDI (xavfsizlik uchun).
 * @return {Array<{nomi:string, havola:string}>}
 */
function getProducts() {
  var sheet = getSheet_(SHEET_MAHSULOT);
  var lastRow = sheet.getLastRow();
  var result = [];
  if (lastRow < 2) return result;

  var values = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  var richC = sheet.getRange(2, 3, lastRow - 1, 1).getRichTextValues(); // C ustuni havolalari

  for (var i = 0; i < values.length; i++) {
    var nomi = String(values[i][0]).trim();
    if (nomi === '') continue;
    var havola = String(values[i][2]).trim();

    // Agar katak havola (hyperlink) sifatida bo'lsa, haqiqiy URL'ni olamiz
    try {
      var rt = richC[i][0];
      var link = rt ? rt.getLinkUrl() : null;
      if (!link && rt && rt.getRuns) {
        var runs = rt.getRuns();
        for (var r = 0; r < runs.length; r++) {
          var u = runs[r].getLinkUrl();
          if (u) { link = u; break; }
        }
      }
      if (link) havola = link;
    } catch (e) { /* rich text bo'lmasa, matn qiymati ishlatiladi */ }

    result.push({ nomi: nomi, havola: havola });
  }
  return result;
}

/**
 * Buyurtmani tasdiqlaydi: RSA kalit yordamida litsenziya (licenseStr) ishlab chiqadi,
 * uni Activation_key ustuniga yozadi va holatni "Tasdiqlangan" qiladi.
 * @param {string} adminPhone
 * @param {number} row
 * @return {{ok:boolean, message:string, activationKey?:string}}
 */
function approveOrder(adminPhone, row, manualKey) {
  var auth = checkPhone(adminPhone);
  if (!auth.ok || !auth.isAdmin) {
    return { ok: false, message: 'Ruxsat yo\'q.' };
  }

  var sheet = getSheet_(SHEET_BUYURTMA);
  var rowData = sheet.getRange(row, 1, 1, BUYURTMA_COLS).getDisplayValues()[0];
  var mahsulot = String(rowData[COL.MAHSULOT - 1]).trim();
  var productKey = String(rowData[COL.PRODUCT_KEY - 1]).trim();
  var muddati = String(rowData[COL.MUDDATI - 1]).trim();

  var activationKey;

  if (isClassifierProduct_(mahsulot)) {
    // "Shartli belgilar klassifikatori" -> RSA litsenziya avtomatik ishlab chiqiladi
    if (!productKey) {
      return { ok: false, message: 'Product Key bo\'sh — litsenziya yaratib bo\'lmaydi.' };
    }
    var rsaXml = getRsaKeyForProduct_(mahsulot);
    if (!rsaXml) {
      return { ok: false, message: 'RSA maxfiy kalit topilmadi. MAHSULOT sahifasida "' + mahsulot + '" uchun RSA_kalit ustunini to\'ldiring.' };
    }
    try {
      activationKey = generateLicense_(productKey, rsaXml, muddati);
    } catch (e) {
      return { ok: false, message: 'Litsenziya yaratishda xato: ' + e.message };
    }
  } else {
    // Boshqa mahsulotlar -> admin kalitni qo'lda kiritadi (usullari keyin qo'shiladi)
    if (!manualKey || String(manualKey).trim() === '') {
      return {
        ok: false,
        needManualKey: true,
        message: '"' + mahsulot + '" mahsuloti uchun Activation key ni qo\'lda kiriting.'
      };
    }
    activationKey = String(manualKey).trim();
  }

  ensureHolatiHeader_();
  sheet.getRange(row, COL.ACTIVATION_KEY).setValue(activationKey);
  sheet.getRange(row, COL.HOLATI).setValue(STATUS_APPROVED);
  return { ok: true, message: 'Buyurtma tasdiqlandi.', activationKey: activationKey };
}

/**
 * Buyurtmani rad etadi (holatni "Rad etilgan" qiladi).
 * @param {string} adminPhone
 * @param {number} row
 */
function rejectOrder(adminPhone, row) {
  var auth = checkPhone(adminPhone);
  if (!auth.ok || !auth.isAdmin) {
    return { ok: false, message: 'Ruxsat yo\'q.' };
  }
  var sheet = getSheet_(SHEET_BUYURTMA);
  ensureHolatiHeader_();
  sheet.getRange(row, COL.ACTIVATION_KEY).setValue('');
  sheet.getRange(row, COL.HOLATI).setValue(STATUS_REJECTED);
  return { ok: true, message: 'Buyurtma rad etildi.' };
}


// ============================================================
//  LITSENZIYA ISHLAB CHIQISH (RSA) — LicenseTopo bilan mos
//  Algoritm Node.js'da tekshirilgan (imzo .NET RSA VerifyData bilan bir xil).
// ============================================================

var B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
var TICKS_EPOCH = 621355968000000000; // DateTime(1970,1,1,UTC).Ticks — BigInt sifatida ishlatiladi

// SHA-256 uchun ASN.1 DigestInfo prefiksi (EMSA-PKCS1-v1_5)
var SHA256_DER_PREFIX = [
  0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01,
  0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20
];

/* ---------- bayt yordamchilari ---------- */

// Apps Script signed byte[] (-128..127) -> unsigned (0..255) massiv
function toUnsigned_(bytes) {
  var out = [];
  for (var i = 0; i < bytes.length; i++) out.push(bytes[i] & 0xff);
  return out;
}
// unsigned (0..255) -> signed byte[] (Utilities.newBlob uchun)
function toSigned_(bytes) {
  var out = [];
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i] & 0xff;
    out.push(v > 127 ? v - 256 : v);
  }
  return out;
}

/* ---------- Base32 (LicenseTopo bilan bir xil) ---------- */
function base32Encode_(data) {
  var out = '', bits = 0, val = 0;
  for (var i = 0; i < data.length; i++) {
    val = (val << 8) | (data[i] & 0xff); bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(val >> (bits - 5)) & 31]; bits -= 5; val &= (1 << bits) - 1; }
  }
  if (bits > 0) out += B32_ALPHABET[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode_(str) {
  str = String(str).toUpperCase();
  var out = [], bits = 0, val = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    if (c === '-' || c === '\n' || c === '\r' || c === ' ' || c === '\t') continue;
    var idx = B32_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error("Yaroqsiz Base32 belgi: '" + c + "'");
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((val >> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
  }
  return out;
}

/* ---------- GZip (Apps Script Utilities) ---------- */
function gzipBytes_(unsignedBytes) {
  var blob = Utilities.newBlob(toSigned_(unsignedBytes), 'application/octet-stream');
  return toUnsigned_(Utilities.gzip(blob).getBytes());
}
function gunzipToString_(unsignedGzBytes) {
  var blob = Utilities.newBlob(toSigned_(unsignedGzBytes), 'application/x-gzip', 'data.gz');
  return Utilities.ungzip(blob).getDataAsString('UTF-8');
}

/* ---------- BigInt yordamchilari ---------- */
function bytesToBigInt_(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var h = (bytes[i] & 0xff).toString(16);
    hex += (h.length === 1 ? '0' : '') + h;
  }
  return hex.length ? BigInt('0x' + hex) : BigInt(0);
}
function bigIntToBytes_(num, len) {
  var hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  while (bytes.length < len) bytes.unshift(0);
  return bytes;
}
function b64ToBigInt_(b64) {
  return bytesToBigInt_(toUnsigned_(Utilities.base64Decode(b64)));
}
function modPow_(base, exp, mod) {
  var ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2);
  base = base % mod;
  var result = ONE;
  while (exp > ZERO) {
    if (exp % TWO === ONE) result = (result * base) % mod;
    exp = exp / TWO;
    base = (base * base) % mod;
  }
  return result;
}

/* ---------- .NET RSA XML parse ---------- */
function parseRsaXml_(xml) {
  function tag(name) {
    var m = String(xml).match(new RegExp('<' + name + '>([^<]*)</' + name + '>'));
    return m ? m[1].trim() : null;
  }
  var need = ['Modulus', 'Exponent', 'D', 'P', 'Q', 'DP', 'DQ', 'InverseQ'];
  var v = {};
  for (var i = 0; i < need.length; i++) {
    var t = tag(need[i]);
    if (!t) throw new Error("RSA XML da <" + need[i] + "> topilmadi (to'liq private key kerak).");
    v[need[i]] = b64ToBigInt_(t);
  }
  return v;
}

/* ---------- SHA-256 + EMSA-PKCS1-v1_5 padding ---------- */
function sha256Bytes_(str) {
  return toUnsigned_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8));
}
function emsaPkcs1_(str, k) {
  var hash = sha256Bytes_(str);
  var T = SHA256_DER_PREFIX.concat(hash); // 19 + 32 = 51
  var psLen = k - T.length - 3;
  if (psLen < 8) throw new Error('RSA modul juda kichik.');
  var em = [0x00, 0x01];
  for (var i = 0; i < psLen; i++) em.push(0xff);
  em.push(0x00);
  for (var j = 0; j < T.length; j++) em.push(T[j]);
  return em; // uzunligi k
}

/* ---------- RSA imzo (CRT) ---------- */
function rsaSignPkcs1Sha256_(payloadStr, xmlKey) {
  var key = parseRsaXml_(xmlKey);
  var k = bigIntToBytes_(key.Modulus, 0).length; // modul bayt uzunligi (256)
  var em = emsaPkcs1_(payloadStr, k);
  var m = bytesToBigInt_(em);

  // CRT: s = m2 + q * ((qi*(m1-m2)) mod p)
  var m1 = modPow_(m, key.DP, key.P);
  var m2 = modPow_(m, key.DQ, key.Q);
  var diff = (m1 - m2) % key.P;
  if (diff < BigInt(0)) diff += key.P;
  var h = (key.InverseQ * diff) % key.P;
  var s = m2 + h * key.Q;

  // O'z-o'zini tekshirish: s^e mod n === m bo'lishi kerak
  var check = modPow_(s, key.Exponent, key.Modulus);
  if (check !== m) {
    throw new Error("RSA imzo tekshiruvi muvaffaqiyatsiz — kalit noto'g'ri yoki to'liq emas.");
  }
  return bigIntToBytes_(s, k); // 256 bayt (unsigned)
}

/* ---------- Machine ID (Base32) -> ProcessorId ---------- */
function machineIdToProcessorId_(productKey) {
  var gz = base32Decode_(productKey);
  try {
    return gunzipToString_(gz);
  } catch (e) {
    throw new Error("Product Key ni ProcessorId ga aylantirib bo'lmadi (Base32/GZip xato). To'g'ri Machine ID kiriting.");
  }
}

/* ---------- Muddat -> .NET ticks (BigInt string) ---------- */
function muddatiToExpiryTicks_(muddati) {
  var m = String(muddati).toLowerCase().trim();
  var ms;
  if (m.indexOf('muddatsiz') !== -1 || m.indexOf('9999') !== -1) {
    ms = Date.UTC(9999, 11, 31, 23, 59, 0);
  } else {
    var now = new Date();
    var y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate(),
        h = now.getUTCHours(), mi = now.getUTCMinutes();
    var num = parseInt(m, 10);
    if (isNaN(num) || num <= 0) num = 1;
    if (m.indexOf('yil') !== -1) y += num;
    else if (m.indexOf('oy') !== -1) mo += num; // Date.UTC oy oshib ketishini o'zi hisoblaydi
    else y += num; // noma'lum bo'lsa yil deb qabul qilamiz
    ms = Date.UTC(y, mo, d, h, mi, 0);
  }
  var ticks = BigInt(ms) * BigInt(10000) + BigInt('621355968000000000');
  return ticks.toString();
}

/**
 * To'liq litsenziya (licenseStr) ishlab chiqadi.
 * @param {string} productKey  Machine ID (Base32) — buyurtmachi yuborgan Product Key
 * @param {string} rsaXml      .NET XML RSA maxfiy kalit
 * @param {string} muddati     Masalan "1 oy", "1 yil", "Muddatsiz"
 * @return {string} licenseStr (Base32) — bu Activation key
 */
function generateLicense_(productKey, rsaXml, muddati) {
  var processorId = machineIdToProcessorId_(productKey);
  var ticksStr = muddatiToExpiryTicks_(muddati);
  var payloadStr = processorId + '|' + ticksStr;

  // payload UTF-8 baytlari
  var payloadBytes = toUnsigned_(Utilities.newBlob(payloadStr).getBytes());

  // RSA-SHA256 imzo (256 bayt)
  var sig = rsaSignPkcs1Sha256_(payloadStr, rsaXml);
  if (sig.length !== 256) {
    throw new Error('Imzo uzunligi 256 emas (' + sig.length + '). RSA-2048 kalit kerak.');
  }

  // combined = payload + imzo, so'ng GZip + Base32
  var combined = payloadBytes.concat(sig);
  var gz = gzipBytes_(combined);
  return base32Encode_(gz);
}
