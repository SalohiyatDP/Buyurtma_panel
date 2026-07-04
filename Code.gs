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

// BUYURTMA ustunlari tartibi (1-indeksli)
var COL = {
  FIO: 1,
  TELEFON: 2,
  PRODUCT_KEY: 3,
  ACTIVATION_KEY: 4,
  MUDDATI: 5,
  TOLOV_KARTASI: 6,
  TOLOV_VAQTI: 7
};

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
 * @return {Array<{muddat:string, qiymati:string, karta:string}>}
 */
function getPricing() {
  var sheet = getSheet_(SHEET_NARXLANISH);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  var result = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === '') continue;
    result.push({
      muddat: String(values[i][0]).trim(),
      qiymati: String(values[i][1]).trim(),
      karta: String(values[i][2]).trim()
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
    productKey: String(row[COL.PRODUCT_KEY - 1]),
    activationKey: String(row[COL.ACTIVATION_KEY - 1]),
    muddati: String(row[COL.MUDDATI - 1]),
    tolovKartasi: String(row[COL.TOLOV_KARTASI - 1]),
    tolovVaqti: String(row[COL.TOLOV_VAQTI - 1])
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
    var values = sheet.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
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

    var sheet = getSheet_(SHEET_BUYURTMA);
    var newRow = [];
    newRow[COL.FIO - 1] = String(data.fio).trim();
    newRow[COL.TELEFON - 1] = "998" + norm; // to'liq formatda saqlaymiz
    newRow[COL.PRODUCT_KEY - 1] = String(data.productKey).trim();
    newRow[COL.ACTIVATION_KEY - 1] = ''; // admin keyin to'ldiradi
    newRow[COL.MUDDATI - 1] = String(data.muddati).trim();
    newRow[COL.TOLOV_KARTASI - 1] = String(data.tolovKartasi).trim();
    newRow[COL.TOLOV_VAQTI - 1] = String(data.tolovVaqti).trim();

    sheet.appendRow(newRow);
    return { ok: true, message: 'Buyurtmangiz qabul qilindi! Faollashtirish kalitini kuting.' };
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
    var values = sheet.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
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
 * Admin tomonidan faollashtirish kalitini o'rnatadi.
 * @param {string} phone admin telefon raqami (huquqni tekshirish uchun)
 * @param {number} row buyurtma qatori raqami
 * @param {string} activationKey
 */
function setActivationKey(phone, row, activationKey) {
  var auth = checkPhone(phone);
  if (!auth.ok || !auth.isAdmin) {
    return { ok: false, message: 'Ruxsat yo\'q.' };
  }
  if (!activationKey || String(activationKey).trim() === '') {
    return { ok: false, message: 'Faollashtirish kaliti bo\'sh bo\'lishi mumkin emas.' };
  }
  var sheet = getSheet_(SHEET_BUYURTMA);
  sheet.getRange(row, COL.ACTIVATION_KEY).setValue(String(activationKey).trim());
  return { ok: true, message: 'Faollashtirish kaliti saqlandi.' };
}
