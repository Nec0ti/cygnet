# Cygnet backlog

## Durum özeti

- Aşama: 1.1/2.0 üstüne kalıcı süre ölçümü, full test paketi, launcher ve benchmark tamamlandı; değişiklikler bu teslimatta private `main`e gönderilecek
- Son tamamlanan iş: izole API action matrisi ve restart, browser tracker, launcher ve 100/1.000 profil benchmark doğrulaması
- Şu an yapılan iş: uygulama/doğrulama bitti; commit/push ve teslim handoff'u
- Sıradaki adım: yerel simülasyonu bir hafta çalıştırıp gerçek deney raporu üretmek
- Açık sınır: gerçek bir haftalık çalışma verisi henüz toplanmadı
- Benchmark sınırı: 1.000 profil/100.000 event raporu tek istekte p95 5,02 sn, 10 eşzamanlı rapor isteğinde p95 38,99 sn; ayrıntı `reports/benchmark-2026-11-13T18-33.md` içinde

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
