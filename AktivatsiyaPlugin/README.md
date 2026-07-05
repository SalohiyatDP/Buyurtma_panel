# Aktivatsiya.bundle — AutoCAD plagini

AutoCAD lentasida (ribbon) **"Aktivatsiya"** tabi va undagi yagona **"Aktivatsiya qilish"** tugmasini qo'shadi. Tugma bosilganda `Contents/link.txt` faylidagi havola brauzerda ochiladi.

## Qo'llab-quvvatlanadigan versiyalar

| AutoCAD versiyasi | R-raqami | Runtime | Yuklanadigan DLL |
|-------------------|----------|---------|------------------|
| 2018 | R22.0 | .NET Framework | `Contents/acad-net4/Aktivatsiya.dll` |
| 2020 | R23.1 | .NET Framework | `Contents/acad-net4/Aktivatsiya.dll` |
| 2021 | R24.0 | .NET Framework | `Contents/acad-net4/Aktivatsiya.dll` |
| **AutoCAD Mechanical 2021** | R24.0 | .NET Framework | `Contents/acad-net4/Aktivatsiya.dll` |
| 2024 | R24.3 | .NET Framework | `Contents/acad-net4/Aktivatsiya.dll` |
| 2025 | R25.0 | .NET 8 | `Contents/acad-net8/Aktivatsiya.dll` |

`PackageContents.xml` versiyaga qarab (SeriesMin/SeriesMax) to'g'ri DLL'ni avtomatik tanlaydi. `Platform="AutoCAD*"` — AutoCAD Mechanical kabi variantlarni ham qamrab oladi.

## Tuzilma

```
Aktivatsiya.sln                 ← Visual Studio solution
AktivatsiyaPlugin/              ← manba kod
├── Aktivatsiya.csproj          ← multi-target: net46 + net8.0-windows
├── RibbonAktivatsiya.cs
└── Properties/AssemblyInfo.cs
Aktivatsiya.bundle/            ← deploy qilinadigan paket
├── PackageContents.xml
└── Contents/
    ├── link.txt                ← ochiladigan havola (shu yerni tahrirlang)
    ├── acad-net4/Aktivatsiya.dll   ← build'dan keyin (2018-2024 + Mechanical)
    └── acad-net8/Aktivatsiya.dll   ← build'dan keyin (2025)
```

## 1. Havolani sozlash

`Aktivatsiya.bundle/Contents/link.txt` faylini oching va havolani yozing:

```
https://sizning-saytingiz.uz/aktivatsiya
```

> Birinchi bo'sh bo'lmagan qator ishlatiladi. `https://` yozilmasa avtomatik qo'shiladi.
> `link.txt` bitta — ikkala versiya (net4/net8) uchun umumiy (kod uni yuqori papkadan topadi).

## 2. Build qilish

**Talab:** .NET SDK (8.0), va build qilinadigan kompyuterda mos AutoCAD versiyalari o'rnatilgan bo'lishi (kerakli `.dll`'lar o'sha yerdan olinadi).

Solution papkasida:

```powershell
dotnet build Aktivatsiya.sln -c Release
```

DLL'lar avtomatik `Aktivatsiya.bundle\Contents\acad-net4\` va `...\acad-net8\` ga chiqadi.

### AutoCAD papkalarini ko'rsatish

Ko'zda tutilgan yo'llar: `AutoCAD 2018` (net4 uchun) va `AutoCAD 2025` (net8 uchun). Ularni override qilish mumkin:

```powershell
dotnet build Aktivatsiya.sln -c Release ^
  -p:AcadDir="C:\Program Files\Autodesk\AutoCAD 2018\" ^
  -p:AcadDir2025="C:\Program Files\Autodesk\AutoCAD 2025\"
```

> **Moslik qoidasi:** .NET Framework DLL'ni **eng eski** qo'llab-quvvatlanadigan versiya (2018) API'siga qarshi qursangiz, u 2018–2024 (va Mechanical 2021) da ishlaydi. Agar bironta versiyada yuklanmasa, `AcadDir`ni o'sha versiyaga o'zgartirib qayta quring.

### Faqat bitta target'ni build qilish

```powershell
dotnet build AktivatsiyaPlugin\Aktivatsiya.csproj -c Release -f net46            # 2018-2024
dotnet build AktivatsiyaPlugin\Aktivatsiya.csproj -c Release -f net8.0-windows   # 2025
```

## 3. O'rnatish

Butun **`Aktivatsiya.bundle`** papkasini (ichida DLL'lar bilan) quyidagilardan biriga ko'chiring:

- Joriy foydalanuvchi: `%APPDATA%\Autodesk\ApplicationPlugins\`
- Barcha foydalanuvchilar: `%PROGRAMFILES%\Autodesk\ApplicationPlugins\`

So'ng AutoCAD'ni **qayta ishga tushiring** — lentada **"Aktivatsiya"** tabi va **"Aktivatsiya qilish"** tugmasi paydo bo'ladi.

## 4. Ishlatish

- Lentadagi **"Aktivatsiya qilish"** tugmasini bosing, yoki
- Buyruq qatoriga **`AKTIVATSIYA`** deb yozing.

Ikkalasida ham `link.txt` dagi havola brauzerda ochiladi.

## Tez-tez uchraydigan muammolar

| Muammo | Yechim |
|--------|--------|
| Tab ko'rinmayapti | Mos DLL (`acad-net4` yoki `acad-net8`) mavjudmi va bundle to'g'ri papkaga ko'chirilganmi? AutoCAD qayta ishga tushirilganmi? |
| Build: `accoremgd.dll topilmadi` | `AcadDir` / `AcadDir2025` yo'llarini o'z versiyangizga moslang. |
| Muayyan versiyada yuklanmayapti | `AcadDir`ni o'sha versiyaga qo'yib `net46` target'ni qayta build qiling. |
| "link.txt topilmadi" | `Contents/link.txt` mavjud va havola yozilganini tekshiring. |
| DLL bloklangan | DLL xossalaridan "Unblock" belgilang. |
