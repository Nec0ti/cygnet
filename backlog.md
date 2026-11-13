# Cygnet backlog

## Durum özeti

- Aşama: 1.0 doğrulandı ve private `main`e gönderildi
- Son tamamlanan iş: eski şemadan migration, ayarlar/nüfus/arşiv API'si, retry toparlanması ve gerçek Codex blok aşma akışı izole veritabanında doğrulandı
- Şu an yapılan iş: 1.0 tamamlandı
- Sıradaki adım: yerelde uygulamayı çalıştırıp bir haftalık deney verisi toplamak; sonra 1.1 raporunu hazırlamak
- MVP/1.0 dışında henüz kontrol edilmeyenler: tarayıcı görsel E2E'si ve bir haftalık sürekli çalışma

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

### Cygnet 1.0

- [x] Persona hafızası, arkadaşlık hook'u ve DM bağlamı.
- [x] Kalıcı nüfus/simülasyon ayarları, filtreli olay arşivi, exponential backoff ve 10 ajan sınırı.
- [x] Varsayılan kapalı, tek seferlik alternatif hesap blok aşma senaryosu.
- [x] Seed feed için imagegen fotoğrafları.
- [x] Uçtan uca yeni DB kontrolü; test raporu ve belge/depo senkronizasyonu.

## Kayıt kuralı

Her oturumun sonunda `backloglog.md` dosyasına tarihli kısa kayıt ekle. `backlog.md` içindeki durum özeti, tamamlanan işler, yarım kalan işler ve sıradaki adım bu kayıtla tutarlı olsun. Kontrol edilmemiş işi tamamlandı sayma.
