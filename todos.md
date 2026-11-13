# Cygnet sürüm planı

## MVP — ilk sürüm

- Yerelde çalışan React arayüzü ve yerel veri saklama.
- Ana akış, story, post detayları, beğeni, yorum/yanıt ve bildirimler.
- Profil: kendi profilinde düzenleme/gönderi oluşturma; diğer profillerde yalnızca görüntüleme.
- DM: metin/fotoğraf, mesaj silme, engelleme, report ve profile gitme.
- Yerel medya deposu; Codex CLI yerleşik `imagegen` ile gönderi görseli üretimi.
- 100 başlangıç personası; ülke/yaş dağılımı, İngilizce içerik, kişi başına `system.md`.
- Medium orkestratör ve en çok 10 eşzamanlı low persona ajanı; persona bazlı post/story/DM ritmi.
- Hook/olay akışıyla sosyal etkileşim ve `system.md` güncellemeleri.
- Deney olaylarını yerelde kaydetme ve dışa aktarma.
- Yerel başlatma, durdurma, yeniden başlatma ve yedekleme talimatları.

## 1.0 — tutarlı ve gözlemlenebilir simülasyon

- Arkadaşlık/ilişki grafiği, hafıza ve kişilik değişimlerini daha tutarlı güncelleme.
- Ajan planlama kuyruğu, hata toparlama ve 10 etkin persona sınırını güvenilir uygulama.
- Taciz, blok aşma ve alternatif hesap senaryoları; gerektiğinde yaklaşık 1.000 profil hedefini aşma.
- Olay zaman çizelgesi, filtrelenebilir arşiv ve deney verisi dışa aktarma.
- Persona dağılımı ve simülasyon hızını yerel ayarlardan değiştirme.

## 1.1 — deney raporu

- Bir haftalık istatistikler: post/story/DM sayıları, etkileşim, takip ağı değişimi, persona aktivitesi, görsel sayısı ve üretim başarısızlığı.
- JSON/CSV veri dışa aktarma ve özet rapor.
- Tekrarlanabilir deney için ayarları ve olay kayıtlarını birlikte arşivleme.

## 2.0 — deney ihtiyacı gösterirse

- Arama, feed sıralaması ve arayüz/erişilebilirlik iyileştirmeleri.
- Kontrollü persona deneyleri ve tekrar oynatma.
- Karakter tutarlılığı veya alternatif yerel görsel sağlayıcısı.

## Durum

- [x] Başlangıç dokümantasyonu ve ürün kararları
- [x] Sürüm yol haritası
- [ ] Özel GitHub deposu ve başlangıç commit'i
- [ ] MVP uygulaması
- [x] Codex CLI yerleşik `imagegen` ile bir deneme görseli üretme ve görseli kontrol etme
- [ ] Codex CLI text/imagegen iş akışını Cygnet uygulamasına bağlama; görsel dosyası yerel medya klasörüne taşınmalı
- [ ] Uçtan uca yerel kullanım ve veri dışa aktarma
- [ ] Deney raporu

Her sürümde tamamlanmayan iş backlog'da açık kalır; en yeni kayıt `backloglog.md` içine eklenir.
