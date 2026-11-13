# Cygnet backlog

## Durum özeti

- Aşama: 1.1 raporlama ve 2.0 geliştirmesi
- Son tamamlanan iş: Cygnet 1.0 doğrulandı ve private `main`e gönderildi (`ed80871`)
- Şu an yapılan iş: tarih aralıklı deney raporu, keşif/erişilebilirlik ve kohort/replay özellikleri
- Sıradaki adım: 1.1 API ve 2.0 kohort altyapısını birleştirip UI'ı bağlamak; her akışı izole DB'de doğrulamak
- Açık sınırlar: gerçek haftalık deney verisi henüz yok; raporlama aracı bittiğinde kullanıcı çalıştırması gerekecek

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

### Cygnet 1.1

- [ ] Tarih aralıklı JSON/CSV metrik raporu ve ayar snapshot'ı.
- [ ] Rapor API self-check'leri ve UI'dan indirme.
- [ ] Gerçek bir haftalık simülasyon çalıştırıp rapor üretme (araç hazır olunca kullanıcı yerel deneyini başlatabilir).

### Cygnet 2.0

- [ ] Profil araması, feed sıralaması ve temel klavye/ekran okuyucu iyileştirmeleri.
- [ ] Açık persona kohortları ve ayar snapshot'ı ile etkinlik karşılaştırma.
- [ ] Salt okunur olay günlüğü replay'i; hiçbir sosyal işlemi tekrar çalıştırmaz.
- [ ] Karakter/yaş sınırı self-check ve uçtan uca API/UI doğrulaması.

## Kayıt kuralı

Her oturumun sonunda `backloglog.md` dosyasına tarihli kısa kayıt ekle. `backlog.md` içindeki durum özeti, tamamlanan işler, yarım kalan işler ve sıradaki adım bu kayıtla tutarlı olsun. Kontrol edilmemiş işi tamamlandı sayma.
