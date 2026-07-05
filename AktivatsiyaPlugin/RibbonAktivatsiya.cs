using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.Windows;

// AutoCAD ushbu klassni avtoyuklash paytida ishga tushiradi (IExtensionApplication).
[assembly: ExtensionApplication(typeof(Aktivatsiya.AktivatsiyaApp))]
[assembly: CommandClass(typeof(Aktivatsiya.AktivatsiyaApp))]

namespace Aktivatsiya
{
    /// <summary>
    /// Lentaga "Aktivatsiya" tabi va "Aktivatsiya qilish" tugmasini qo'shadi.
    /// Tugma bosilganda (yoki AKTIVATSIYA buyrug'i yozilganda) link.txt dagi havola ochiladi.
    /// </summary>
    public class AktivatsiyaApp : IExtensionApplication
    {
        private const string TabId = "SALOHIYAT_AKTIVATSIYA_TAB";
        private const string PanelId = "SALOHIYAT_AKTIVATSIYA_PANEL";

        // ===== Avtoyuklash =====
        public void Initialize()
        {
            try
            {
                // Lenta tayyor bo'lsa darhol, aks holda tayyor bo'lgach quramiz.
                if (ComponentManager.Ribbon != null)
                    CreateRibbon();
                else
                    ComponentManager.ItemInitialized += ComponentManager_ItemInitialized;
            }
            catch
            {
                // Avtoyuklashda xatolik AutoCAD ishga tushishiga xalaqit bermasin.
            }
        }

        public void Terminate() { }

        private void ComponentManager_ItemInitialized(object sender, RibbonItemEventArgs e)
        {
            if (ComponentManager.Ribbon != null)
            {
                CreateRibbon();
                ComponentManager.ItemInitialized -= ComponentManager_ItemInitialized;
            }
        }

        // ===== Lentani qurish =====
        private void CreateRibbon()
        {
            RibbonControl ribbon = ComponentManager.Ribbon;
            if (ribbon == null) return;

            // Takror qo'shilishning oldini olamiz.
            if (ribbon.Tabs.Any(t => t.Id == TabId)) return;

            RibbonTab tab = new RibbonTab { Title = "Aktivatsiya", Id = TabId };
            ribbon.Tabs.Add(tab);

            RibbonPanelSource source = new RibbonPanelSource { Title = "Aktivatsiya", Id = PanelId };
            RibbonPanel panel = new RibbonPanel { Source = source };
            tab.Panels.Add(panel);

            RibbonButton button = new RibbonButton
            {
                Text = "Aktivatsiya qilish",
                ShowText = true,
                ShowImage = true,
                Size = RibbonItemSize.Large,
                Orientation = System.Windows.Controls.Orientation.Vertical,
                LargeImage = CreateIcon(32),
                Image = CreateIcon(16),
                CommandHandler = new RelayCommand(_ => RunAktivatsiya())
            };
            source.Items.Add(button);
        }

        // ===== Buyruq sifatida ham chaqirish mumkin: AKTIVATSIYA =====
        [CommandMethod("AKTIVATSIYA")]
        public void AktivatsiyaCommand()
        {
            RunAktivatsiya();
        }

        // ===== Asosiy amal: link.txt dagi havolani ochish =====
        private static void RunAktivatsiya()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc != null ? doc.Editor : null;
            try
            {
                string url = ReadLink();
                if (string.IsNullOrEmpty(url))
                {
                    Application.ShowAlertDialog("link.txt fayli topilmadi yoki bo'sh.\n" +
                        "Fayl joylashuvi: <bundle>\\Contents\\link.txt");
                    return;
                }
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                if (ed != null) ed.WriteMessage("\n[Aktivatsiya] Havola ochildi: " + url);
            }
            catch (System.Exception ex)
            {
                if (ed != null) ed.WriteMessage("\n[Aktivatsiya] Xato: " + ex.Message);
                else Application.ShowAlertDialog("Aktivatsiya xatosi: " + ex.Message);
            }
        }

        /// <summary>
        /// link.txt dagi birinchi bo'sh bo'lmagan qatorni URL sifatida qaytaradi.
        /// DLL "Contents/acad-net4" (yoki "acad-net8") ichida, link.txt esa "Contents" da
        /// bo'lgani uchun faylni yuqori papkalarda ham qidiramiz.
        /// </summary>
        private static string ReadLink()
        {
            string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string file = null;
            for (int i = 0; i < 4 && !string.IsNullOrEmpty(dir); i++)
            {
                string candidate = Path.Combine(dir, "link.txt");
                if (File.Exists(candidate)) { file = candidate; break; }
                dir = Path.GetDirectoryName(dir); // bir pog'ona yuqoriga
            }
            if (file == null) return null;

            string url = File.ReadAllLines(file)
                .Select(l => l.Trim())
                .FirstOrDefault(l => l.Length > 0);

            if (string.IsNullOrEmpty(url)) return null;
            // Sxema ko'rsatilmagan bo'lsa https qo'shamiz (masalan "example.com").
            if (!url.Contains("://")) url = "https://" + url;
            return url;
        }

        /// <summary>Tugma uchun oddiy ikonka (yashil dumaloq kvadrat + oq "power" belgisi).</summary>
        private static ImageSource CreateIcon(int size)
        {
            var visual = new DrawingVisual();
            using (DrawingContext dc = visual.RenderOpen())
            {
                var bg = new SolidColorBrush(Color.FromRgb(0x16, 0xA3, 0x4A)); // yashil
                dc.DrawRoundedRectangle(bg, null,
                    new System.Windows.Rect(0, 0, size, size), size * 0.22, size * 0.22);

                var pen = new System.Windows.Media.Pen(System.Windows.Media.Brushes.White, size * 0.11);
                double r = size * 0.26;
                double cx = size / 2.0, cy = size / 2.0 + size * 0.05;
                dc.DrawEllipse(null, pen, new System.Windows.Point(cx, cy), r, r);
                dc.DrawLine(pen,
                    new System.Windows.Point(cx, cy - r - size * 0.05),
                    new System.Windows.Point(cx, cy - size * 0.02));
            }
            var rtb = new RenderTargetBitmap(size, size, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(visual);
            rtb.Freeze();
            return rtb;
        }
    }

    /// <summary>Ribbon tugmasi uchun oddiy ICommand implementatsiyasi.</summary>
    internal class RelayCommand : ICommand
    {
        private readonly Action<object> _execute;
        public RelayCommand(Action<object> execute) { _execute = execute; }
        public event EventHandler CanExecuteChanged { add { } remove { } }
        public bool CanExecute(object parameter) { return true; }
        public void Execute(object parameter) { _execute(parameter); }
    }
}
