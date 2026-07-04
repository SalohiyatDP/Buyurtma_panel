# Buyurtma paneli — Google Apps Script online platforma

Google Sheets ma'lumotlari asosida ishlaydigan buyurtma berish web-ilovasi. Ilova Google Apps Script'ning `HtmlService` xizmati orqali web-ilova (Web App) sifatida ishga tushiriladi.

## Imkoniyatlar

- **Kirish sahifasi** — faqat `+998` bilan boshlanadigan telefon raqami kiritiladi.
- **Aqlli yo'naltirish**:
  - Agar telefon raqami `LOGIN` sahifasida bo'lsa → parol so'raladi va **boshqaruv paneliga** (admin) yo'naltiriladi.
  - Aks holda → to'g'ridan-to'g'ri **buyurtma paneliga** yo'naltiriladi.
- **Buyurtma paneli**:
  - Muddat tanlanganda narx va qaysi kartaga to'lash kerakligi maslahat sifatida ko'rsatiladi (`NARXLANISH` sahifasidan).
  - Buyurtmachi **mahsulot uchun to'lov o'tkazilgan karta raqami** va **to'lov o'tkazilgan sana va vaqt**ni o'zi kiritadi.
  - `Activation_key` **bo'sh** bo'lsa — majburiy maydonlar to'ldiriladi va **"Buyurtma berish"** tugmasi ko'rinadi.
  - `Activation_key` **mavjud** bo'lsa — **"Qayta buyurtma berish"** tugmasi ko'rinadi.
  - `Activation_key` **bo'sh** bo'lsa va buyurtma **rad etilgan** bo'lsa — mos xabar ko'rsatiladi.
- **Boshqaruv paneli (admin)**:
  - Barcha buyurtmalarni jadval ko'rinishida ko'rish, qidirish va statistika.
  - Har bir buyurtma uchun **Tasdiqlash** yoki **Rad etish** tugmasi.
  - **Tasdiqlanganda** — `LOGIN` sahifasidagi RSA maxfiy kalit yordamida litsenziya (`Activation_key`) **avtomatik ishlab chiqiladi** va buyurtmachiga ko'rsatiladi.

## Litsenziya (Activation key) ishlab chiqish

Admin buyurtmani tasdiqlaganda, server tomonda `Topography` mahsulotining `LicenseTopo.ValidateLicense` algoritmiga to'liq mos litsenziya yaratiladi:

1. **Product Key** (Machine ID, Base32) → Base32-dekod → GZip-yechish → `ProcessorId`.
2. **Muddati** (`NARXLANISH`dan) → amal qilish sanasi → .NET `ticks` (UTC).
3. `payload = ProcessorId + "|" + ticks`.
4. `payload` **RSA-SHA256 (PKCS#1 v1.5)** bilan `RSA_kalit` yordamida imzolanadi (256 bayt).
5. `combined = payload + imzo` → GZip → Base32 = **licenseStr** (bu `Activation_key`).

> Algoritm Node.js'da `crypto` (bu .NET `RSA.VerifyData(SHA256)` bilan bir xil) yordamida tekshirilgan — barcha muddatlar uchun imzo ochiq kalit bilan `verify=true` beradi.

⚠️ **Xavfsizlik:** Yaroqli litsenziya yaratish uchun DLL ichidagi ochiq kalitga mos **RSA maxfiy kalit** (`LOGIN` → `RSA_kalit`) kerak. Maxfiy kalitsiz litsenziya yaratib bo'lmaydi.

## Jadval tuzilmasi

Ilova quyidagi 3 ta sahifa (varaq) mavjudligini kutadi:

### `NARXLANISH`
| Muddat | Qiymati | Karta_raqami |
|--------|---------|--------------|
| 1 oy   | 1 000 000,00 so'm | 8600 1234 4567 7894 |
| ...    | ...     | ...          |

### `BUYURTMA`
| Buyurtmachi_FIO | Telefon_raqami | Product_Key | Activation_key | Muddati | Tolov_kartasi | Tolov_vaqti | Holati |
|-----------------|----------------|-------------|----------------|---------|---------------|-------------|--------|

> `Holati` ustuni (H) ilova tomonidan avtomatik boshqariladi: `Kutilmoqda` / `Tasdiqlangan` / `Rad etilgan`. Ustun bo'lmasa, ilova uni o'zi qo'shadi.

### `LOGIN`
| Login | Parol | RSA_kalit |
|-------|-------|-----------|
| 998939113005 | Admin2012 | `<RSAKeyValue><Modulus>...</Modulus>...<D>...</D></RSAKeyValue>` |

> `RSA_kalit` (C ustuni) — .NET XML formatidagi **to'liq RSA maxfiy kalit** (P, Q, DP, DQ, InverseQ, D bilan). Litsenziya imzolash uchun ishlatiladi.

> **Eslatma:** Telefon raqamlari solishtirilganda faqat raqamlar hisobga olinadi (`+`, bo'shliq, `998` prefiksi e'tiborsiz qoldiriladi), shuning uchun `+998 93 911 30 05` va `998939113005` bir xil hisoblanadi.

## Fayllar

| Fayl | Vazifasi |
|------|----------|
| `appsscript.json` | Apps Script manifesti (web-app sozlamalari) |
| `Code.gs`         | Server tomon logikasi (login, narxlar, buyurtmalar, admin) |
| `Index.html`      | Asosiy HTML tuzilma (3 ta ko'rinish) |
| `Styles.html`     | CSS uslublar |
| `JavaScript.html` | Mijoz tomoni logikasi (`google.script.run` chaqiruvlari) |

## O'rnatish (Apps Script muharriri orqali)

1. Google Sheets jadvalingizni oching (sahifalar: `NARXLANISH`, `BUYURTMA`, `LOGIN`).
2. Menyudan **Kengaytmalar → Apps Script** ni tanlang.
3. Loyihaga quyidagi fayllarni yarating va ushbu repozitoriyadagi kontentni ko'chiring:
   - `Code.gs` (mavjud `Code.gs` ichiga)
   - `Index.html`, `Styles.html`, `JavaScript.html` — har birini **Fayl → Yangi → HTML fayl** orqali yarating (nomlarini aynan yuqoridagidek qo'ying, `.html` qo'shmasdan).
   - `appsscript.json` — ko'rish uchun **Sozlamalar → "appsscript.json" manifest faylini ko'rsatish** ni yoqing.
4. **Deploy → New deployment → Web app** ni tanlang.
   - *Execute as*: **Me** (o'zim)
   - *Who has access*: **Anyone** (yoki tashkilotingizga mos variant)
5. Berilgan **Web app URL** manzilini oching — ilova ishga tushadi.

## O'rnatish (clasp orqali — ixtiyoriy)

Agar `clasp` bilan ishlasangiz, ushbu fayllarni to'g'ridan-to'g'ri push qilishingiz mumkin:

```bash
npm install -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>   # yoki: clasp create --type sheets
clasp push
```

## Ishlash mantig'i (qisqacha)

1. Foydalanuvchi telefon raqamini kiritadi → `checkPhone()`.
2. Admin bo'lsa → `verifyAdminPassword()` → boshqaruv paneli.
3. Oddiy foydalanuvchi bo'lsa → buyurtma paneli:
   - `getPricing()` bilan tariflar yuklanadi.
   - `getUserOrders()` bilan mavjud buyurtma holati aniqlanadi.
   - `submitOrder()` bilan yangi buyurtma `BUYURTMA` sahifasiga yoziladi.
4. Admin `setActivationKey()` orqali faollashtirish kalitini beradi.
