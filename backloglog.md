# Backlog günlüğü

> Serbest çalışma günlüğü. En yeni kayıt en üstte; backlog'daki iş sırası ve durumu `backlog.md` dosyasındadır.

## 2026-11-13 — 1.0 geliştirme başladı

- Kullanıcı MVP'yi inceledi ve seed feed'deki SVG çizimlerini düşük gerçekçilikte buldu; 1.0'da Codex imagegen ile dört fotoğraf üretildi ve frontend fallback'leri değiştirildi.
- SQLite'a kalıcı ayarlar ve persona başına sınırlı hafıza eklendi; karşılıklı takip ve DM olayları `system.md` içine yansıyor.
- Simülatörün 1–10 persona sınırı ayardan okunuyor, etkinlik hızı sonraki aralıkları ölçekliyor, hatalarda exponential backoff uygulanıyor.
- Filtrelenebilir/sayfalı olay arşivi ile nüfus dağılımını uygulama ayarları eklendi.
- Varsayılanı kapalı blok aşma akışı: insan bir AI hesabını bloklayıp modu açtıktan sonra tek alternatif hesap ve tek cinsel olmayan DM oluşturulabiliyor.
- UI production build'i, sunucu JS parse kontrolleri ve diff whitespace kontrolü geçti. API/DB migration, simülatör ve senaryo uçtan uca kontrolü henüz çalıştırılmadı.
- Node sözdizimi kontrolleri, `npm run build` ve `git diff --check` geçti. 1.0 kodu ile dokümanlar commit/push için hazır.
- Sıradaki: özel main'e push et; yeni DB entegrasyon kontrolü ve uzun süreli dayanıklılık gözlemini açık bırak.

## 2026-11-13 — MVP uygulaması ve doğrulama

- React arayüzü, Node/SQLite API, 100 başlangıç personası, Codex CLI orkestratörü/persona ajanları ve yerel imagegen bağlantısı main'e alındı.
- Codex CLI ile gerçek görsel üretimi yapıldı; Cygnet runner çıktıyı yerel medya klasörüne kopyaladı ve API post'una bağlandı.
- Karşılıklı takipte AI arkadaşlık kenarları ile `system.md` dosyalarının eşzamanlanması eklendi (`36ab62f`).
- README çalıştırma, veri konumları, dışa aktarma ve model verisi aktarımını açıklıyor.
- İzole SQLite DB'de tam orkestratör → persona → imagegen → post akışı geçti; PNG yerel medya endpoint'inden HTTP 200 döndü ve görsel kontrol edildi.
- `server/npm run check`, web `npm run build`, runner/seed self-check ve `git diff --check` geçti.
- Test veritabanı ve test görseli temizlendi. Görsel tarayıcı E2E'si ve uzun süreli simülasyon henüz çalıştırılmadı.
- README/backlog güncellemesi `69b06bc` ile commit/push edildi; yerel HEAD ve GitHub `main` aynı SHA'da, çalışma ağacı temiz.
- MVP tamamlandı. Sonraki kullanım adımı README'deki yerel başlatma talimatlarıyla bir haftalık deneyi başlatmak.

## 2026-11-13 — MVP geliştirme başladı

- Kullanıcı Codex CLI yerleşik `imagegen` kullanmayı onayladı; görsel API yolu seçilmedi.
- 100 başlangıç profili, %60 ABD profili, 16–30 yaş, İngilizce içerik ve 10 etkin persona + orkestratör kararları kaydedildi.
- Sürüm planı `todos.md` içine eklendi.
- Özel GitHub deposu açıldı ve başlangıç dokümanları commit/push edildi (`2a98fb4`).
- Codex CLI yerleşik `imagegen` ile deneme görseli üretildi ve görsel olarak kontrol edildi. CLI dosyayı `~/.codex/generated_images/<thread-id>/` altına yazıyor; Cygnet sunucusu yerel medya klasörüne kopyalamalı.
- Yerel Codex CLI oturumu ChatGPT hesabıyla giriş yapmış; config'te `gpt-6-luna` var. Runtime görevleri için reasoning effort açıkça ayarlanmalı.
- Sıradaki adım: uygulama iskeleti, çekirdek akış ve Codex CLI işçisini entegre edip doğrulamak.

## 2026-11-13 — Proje başlangıcı

- `cygnet/` proje klasörü ve başlangıç dokümantasyonu oluşturuldu.
- Kullanıcı fikri `notes.md` içine düzenlendi; geliştirme başlamadan önce açık kararlar soruldu.
