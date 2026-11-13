# Cygnet backlog

## Durum özeti

- Aşama: Cygnet 2.2 canlı görseller, takip tabanlı story gizliliği, admin alanı ve default dark theme tamamlandı
- Son tamamlanan iş: `./cygnet.sh check` geçti; gerçek Chromium E2E 19/19; gerçek Codex imagegen DM smoke; benchmark correctness 5/5 (100/1.000 profil)
- Şu an yapılan iş: bu sürüm raporlandı; yedi günlük deney başlamadı
- Sıradaki adım: yerel simülasyonu bir hafta çalıştırıp gerçek deney raporu üretmek
- Açık sınır: gerçek bir haftalık çalışma verisi henüz toplanmadı
- Benchmark sınırı: 1.000 profil/100.000 event raporu concurrency 10'da p95 43,39 sn ve 15,27 MB yanıt; server RSS 647,8 MB. Ayrıntı `reports/benchmark-2026-11-13T20-43.md` içinde
- Sonuç raporu: `reports/2026-11-14-realtime-images-admin-verification.md`

## İşler

### Tamamlandı

- [x] Proje çalışma kurallarını `agent.md` içinde yaz.
- [x] Günlük ve backlog düzenini kur.
- [x] Ürün değişmezleri ve gizli bilgi sınırlarını kaydet.
- [x] Kullanıcı fikrini ve karar bekleyen soruları `notes.md` içinde düzenle.
- [x] `reports/` dizinini oluştur.
- [x] Onaylanan ürün kararlarını ve sürüm planını kaydet.
- [x] Codex CLI yerleşik `imagegen` ile bir görsel üret; dosya çıktısını kontrol et.

### Devam ediyor / bekliyor

- [x] MVP: yerel arayüz, profil/feed/story, görsel postları, DM, bildirimler, takip/beğeni/yorum ve rapor kaydı.
- [x] 100 profillik ağ, `system.md`, 10 etkin persona + orkestratör ve Codex CLI text/imagegen işleri.
- [x] Yerel medya deposu ve üretilen görseli post/story'ye bağlama.
- [x] Yerel çalıştırma, yedekleme/dışa aktarma ve deney raporu talimatları (`README.md`, `/api/export`).
- [x] İzole DB'de tek persona postu ile orkestratör → persona → imagegen → API akışını doğrula; PNG medyası HTTP 200 ile döndü.
- [x] Sunucu açık süresi ve kullanıcı platform süresini restartlar arasında ayrı ayrı sakla; görünür/odaklı sekmelerin birleşimini say ve yedi günlük ilerlemeyi göster.
- [x] Tek komut launcher'ı hazırla; iki servisin izole başlatma ve kapanışını doğrula (`./cygnet.sh`).
- [x] Modüler self-check'leri, HTTP action matrisi, kullanım saati restart senaryosu, browser tracker, production build ve launcher kontrollerini çalıştır (`./cygnet.sh check`).
- [x] 100 ve 1.000 profil için benchmark çalıştır; sentetik DB'leri temizle ve JSON/Markdown raporu yaz (`reports/benchmark-2026-11-13T18-33.*`).
- [x] Gerçek Chromium E2E akışlarını çalıştır; bulunan story başlangıcı ve DM silme hatalarını düzelt (`scripts/browser-e2e.mjs`).
- [x] Gerçek Codex ile 12× hızda bir saat eşdeğeri simülasyon yap; orkestratör atama istemini ve arkadaş grafiği bağlamını düzelt, üç persona sınırı/AI–AI DM/imagegen postunu doğrula.
- [x] 1.000 profil benchmark'ını yenile ve test sonuç raporunu yaz (`reports/2026-11-13-browser-simulation-verification.md`).
- [x] Avatar fotoğrafı, More menüsü, gerçek takip sayıları ve çift onaylı reseti ekle; `./cygnet.sh check`, 17 akışlı gerçek Chromium E2E ve 100/1.000 profil benchmark'ı tamamla (`reports/2026-11-13-profile-reset-verification.md`).

### Cygnet 1.0

- [x] Persona hafızası, arkadaşlık hook'u ve DM bağlamı.
- [x] Kalıcı nüfus/simülasyon ayarları, filtreli olay arşivi, exponential backoff ve 10 ajan sınırı.
- [x] Varsayılan kapalı, tek seferlik alternatif hesap blok aşma senaryosu.
- [x] Seed feed için imagegen fotoğrafları.
- [x] Uçtan uca yeni DB kontrolü; test raporu ve belge/depo senkronizasyonu.

### Cygnet 1.1

- [x] Tarih aralıklı JSON/CSV metrik raporu ve ayar snapshot'ı.
- [x] Rapor API self-check'leri ve UI'dan indirme.
- [ ] Gerçek bir haftalık simülasyon çalıştırıp rapor üretme.

### Cygnet 2.0

- [x] Profil araması, feed sıralaması ve temel klavye/ekran okuyucu iyileştirmeleri.
- [x] Açık persona kohortları, kısa/ifadeci yanıt koşulları, ayar snapshot'ı ile etkinlik karşılaştırma.
- [x] Salt okunur olay günlüğü replay'i; hiçbir sosyal işlemi tekrar çalıştırmaz.
- [x] Karakter/yaş sınırı self-check ve uçtan uca API/UI doğrulaması.

## Kayıt kuralı

Her oturumun sonunda `backloglog.md` dosyasına tarihli kısa kayıt ekle. `backlog.md` içindeki durum özeti, tamamlanan işler, yarım kalan işler ve sıradaki adım bu kayıtla tutarlı olsun. Kontrol edilmemiş işi tamamlandı sayma.
