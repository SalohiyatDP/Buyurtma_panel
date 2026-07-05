# Aktivatsiya.bundle — AutoCAD plagini

AutoCAD lentasida (ribbon) **"Aktivatsiya"** tabi va undagi yagona **"Aktivatsiya qilish"** tugmasini qo'shadi. Tugma bosilganda `Contents/link.txt` faylidagi havola brauzerda ochiladi.

## Tuzilma

```
Aktivatsiya.bundle/
├── PackageContents.xml        ← avtoyuklash manifesti
└── Contents/
    ├── link.txt               ← ochiladigan havola (shu yerni tahrirlang)
    └── Aktivatsiya.dll         ← build qilingandan keyin paydo bo'ladi

AktivatsiyaPlugin/             ← manba kod (deploy qilinmaydi)
├── Aktivatsiya.csproj
├── RibbonAktivatsiya.cs
└── Properties/AssemblyInfo.cs
```

## 1. Havolani sozlash

`Aktivatsiya.bundle/Contents/link.txt` faylini oching va ochilishi kerak bo'lgan havolani yozing, masalan:

```
https://sizning-saytingiz.uz/aktivatsiya
```

> Birinchi bo'sh bo'lmagan qator ishlatiladi. Agar `https://` yozilmasa, avtomatik qo'shiladi.

## 2. Plaginni build qilish (Aktivatsiya.dll)

**Talab:** Visual Studio yoki MSBuild, hamda kompyuterda **AutoCAD o'rnatilgan** bo'lishi (kerakli `.dll`'lar o'sha yerdan olinadi).

`AktivatsiyaPlugin` papkasida:

```powershell
msbuild Aktivatsiya.csproj /p:Configuration=Release /p:AcadDir="C:\Program Files\Autodesk\AutoCAD 2024\"
```

- `AcadDir` — o'zingizdagi AutoCAD versiyasiga moslang (masalan `AutoCAD 2023`).
- Build muvaffaqiyatli bo'lsa, `Aktivatsiya.dll` avtomatik `..\Aktivatsiya.bundle\Contents\` ga chiqadi.

### AutoCAD 2025 va undan yuqori (.NET 8)

AutoCAD 2025+ .NET 8 talab qiladi. `.csproj` dagi `<TargetFrameworkVersion>v4.8</TargetFrameworkVersion>` o'rniga SDK-uslubidagi loyiha ishlating:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
    <AssemblyName>Aktivatsiya</AssemblyName>
    <RootNamespace>Aktivatsiya</RootNamespace>
    <PlatformTarget>x64</PlatformTarget>
    <OutputPath>..\Aktivatsiya.bundle\Contents\</OutputPath>
    <AppendTargetFrameworkToOutputPath>false</AppendTargetFrameworkToOutputPath>
    <AcadDir>C:\Program Files\Autodesk\AutoCAD 2025\</AcadDir>
  </PropertyGroup>
  <ItemGroup>
    <Reference Include="AcCoreMgd"><HintPath>$(AcadDir)accoremgd.dll</HintPath><Private>false</Private></Reference>
    <Reference Include="AcDbMgd"><HintPath>$(AcadDir)acdbmgd.dll</HintPath><Private>false</Private></Reference>
    <Reference Include="AcMgd"><HintPath>$(AcadDir)acmgd.dll</HintPath><Private>false</Private></Reference>
    <Reference Include="AdWindows"><HintPath>$(AcadDir)AdWindows.dll</HintPath><Private>false</Private></Reference>
  </ItemGroup>
</Project>
```

## 3. O'rnatish

Butun **`Aktivatsiya.bundle`** papkasini (ichida `Aktivatsiya.dll` bilan) quyidagi joylardan biriga ko'chiring:

- Faqat joriy foydalanuvchi uchun:
  `%APPDATA%\Autodesk\ApplicationPlugins\`
- Barcha foydalanuvchilar uchun:
  `%PROGRAMFILES%\Autodesk\ApplicationPlugins\`

So'ng AutoCAD'ni **qayta ishga tushiring**. Lentada **"Aktivatsiya"** tabi va **"Aktivatsiya qilish"** tugmasi paydo bo'ladi.

## 4. Ishlatish

- Lentadagi **"Aktivatsiya qilish"** tugmasini bosing, yoki
- Buyruq qatoriga **`AKTIVATSIYA`** deb yozing.

Ikkala holatda ham `link.txt` dagi havola brauzerda ochiladi.

## Tez-tez uchraydigan muammolar

| Muammo | Yechim |
|--------|--------|
| Tab ko'rinmayapti | `Aktivatsiya.dll` `Contents` ichida bormi va bundle to'g'ri papkaga ko'chirilganmi tekshiring. AutoCAD qayta ishga tushirilganmi? |
| Build'da `accoremgd.dll topilmadi` | `AcadDir` yo'lini o'z AutoCAD versiyangizga moslang. |
| "link.txt topilmadi" | `Contents/link.txt` mavjudligini va havola yozilganini tekshiring. |
| DLL yuklanmayapti (bloklangan) | DLL xossalaridan (Properties) "Unblock" belgilang yoki `NETLOAD` orqali test qiling. |
