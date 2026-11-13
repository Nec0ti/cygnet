# Backlog günlüğü

> Serbest çalışma günlüğü. En yeni kayıt en üstte; backlog'daki iş sırası ve durumu `backlog.md` dosyasındadır.

## 2026-11-13 — 1.1 ve 2.0 uygulaması tamamlandı

- 1.1 araştırma alanı tarih aralıklı post/story/DM/etkileşim/takip/report/görsel ve imagegen hata sayılarını özetliyor; JSON/CSV indirme spreadsheet formül enjeksiyonuna karşı korunuyor ve ayar snapshot'ı ekleniyor.
- 2.0 araması profil alanlarını tarıyor; ana akış yeni/beğeni/yorum sıralaması sunuyor. Klavye/focus ve ekran okuyucu etiketleri iyileştirildi.
- Açık A/B persona kohortları kısa/ifadeci yanıt koşullarını uyguluyor; aktif deneyde simülasyon ayarı ve nüfus değişimi kilitli. Replay geçmiş event'leri sırayla gösteriyor ama işlemleri tekrar çalıştırmıyor.
- Seed/system prompt tutarlılığı ve küçük yaş güvenlik sınırları self-check'e alındı; retry, report, experiment ve replay kontrolleri geçti.
- Web production build ve izole API akışı geçti: JSON/CSV raporu, geçersiz tarih, deney oluştur/bitir/karşılaştır, ayar kilidi ve replay kontrol edildi. Tarayıcı görsel E2E'si çalıştırılmadı.
- Test sunucusu ve DB `/tmp` altında açılıp kapatıldı ve silindi; gerçek `server/data` kullanılmadı.
- Değişiklikler `f357bb4` ile private `main`e push edildi; remote SHA yerel HEAD ile eşleşiyor.
- Sıradaki: yerel simülasyonu bir hafta çalıştırıp gerçek kullanım verisiyle rapor hazırlamak.

## 2026-11-13 — 1.1 ve 2.0 çalışması başladı

- Kullanıcı tüm yol haritası tamamlanana kadar devam etmemi istedi; açık kapsam `todos.md` içinde 1.1 rapor araçları ve 2.0 keşif, kohort karşılaştırma, salt okunur replay olarak netleştirildi.
- Raporlar geçmişten veri uydurmayacak; tarih aralığı ve ayar snapshot'ı gösterecek. Gerçek haftalık rapor için yerel simülasyonun bir hafta çalışması gerekecek.
- Rapor API, keşif/erişilebilirlik UI'ı ve kohort/replay veri modülü ayrı worktree'lerde geliştiriliyor; entegrasyonu ana worktree yapacak.
- Sıradaki: modüller hazır olunca API/UI entegrasyonu, izole DB self-check ve commit/push.

## 2026-11-13 — 1.0 doğrulandı ve yayımlandı

- İzole veritabanında migration, ayarlar/nüfus, event arşivi, export, hafıza, retry ve blok sonrası alternatif hesap senaryoları doğrulandı; ayrıntılar `reports/1.0-verification.md` içinde.
- Server/engine/seed self-check'leri ve web production build geçti. Tarayıcı görsel E2E'si ile bir haftalık dayanıklılık çalışması yapılmadı.
- Değişiklikler `f3a4596` ve backlog durum kaydı commit'i ile private `main`e gönderildi; sıradaki adım yerel haftalık deneyi çalıştırmak.

## 2026-11-13 — 1.0 geliştirme başladı

- Kullanıcı MVP'yi inceledi ve seed feed'deki SVG çizimlerini düşük gerçekçilikte buldu; 1.0'da Codex imagegen ile dört fotoğraf üretildi ve frontend fallback'leri değiştirildi.
- SQLite'a kalıcı ayarlar ve persona başına sınırlı hafıza eklendi; karşılıklı takip ve DM olayları `system.md` içine yansıyor.
- Simülatörün 1–10 persona sınırı ayardan okunuyor, etkinlik hızı sonraki aralıkları ölçekliyor, hatalarda exponential backoff uygulanıyor.
- Filtrelenebilir/sayfalı olay arşivi ile nüfus dağılımını uygulama ayarları eklendi.
- Varsayılanı kapalı blok aşma akışı: insan bir AI hesabını bloklayıp modu açtıktan sonra tek alternatif hesap ve tek cinsel olmayan DM oluşturulabiliyor.
- Eski şema migration'ı, ayar doğrulaması (11 worker → 400), nüfus uygulaması (60 ABD, yaş 16–30), event filtre/sayfaları ve JSON export izole test DB'de geçti.
- Canlı Codex testi iki blok olayıyla max worker=1'i doğruladı; kaynak prompt hafızası dosyaya yazıldı. Son prompt sürümü ayrı senaryoda farklı isim/kullanıcı adıyla tek, non-sexual ve eski hesabı anmayan DM üretti.
- Olay sayfalaması testinde eşit timestamp kaynaklı tekrar bulundu ve düzeltildi; iki sayfalı tekrar kontrolü geçti.
- Fake runner self-check'i orchestrator hatasında 15 dakika backoff ve sonraki başarılı tick'te retry state temizlenmesini doğruladı.
- `npm run check`, engine/seed self-check'leri, JS parse kontrolleri, web production build ve `git diff --check` geçti.
- Test DB, persona dosyaları ve medya `/tmp`'te oluşturulup silindi; gerçek `server/data` değiştirilmedi. Tarayıcı görsel E2E'si ve haftalık dayanıklılık deneyi sonraki kullanım içindir.
- Sıradaki: yerelde bir haftalık deneyi başlat; sonra 1.1 raporunu hazırla.

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
