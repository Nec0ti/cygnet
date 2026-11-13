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

- [x] Arkadaşlık ve DM olaylarını persona hafızasına bağlama; `system.md` dosyalarını otomatik yenileme.
- [x] Ayarlanabilir 1–10 persona sınırı, hız ayarı ve artan gecikmeli hata tekrarı.
- [x] İsteğe bağlı blok aşma senaryosu: tek alternatif hesap, tek DM; varsayılan kapalı.
- [x] Filtrelenebilir ve sayfalı yerel olay arşivi; dışa aktarmada ayarlar ve hafıza tabloları.
- [x] Yerel ayarlardan ABD oranı ve yaş aralığını belirleme, 100 temel profile uygulama.
- [x] Başlangıç feed’inde SVG çizimleri yerine dört Codex imagegen fotoğrafı kullanma.
- [ ] Yeni yerel DB üzerinde migration, ayarlar, arşiv ve blok aşma uçtan uca kontrolü.

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
- [x] Özel GitHub deposu ve başlangıç commit'i
- [x] MVP uygulaması
- [x] Codex CLI yerleşik `imagegen` ile bir deneme görseli üretme ve görseli kontrol etme
- [x] Codex CLI text/imagegen iş akışını Cygnet uygulamasına bağlama; görsel dosyası yerel medya klasörüne taşınmalı
- [x] Uçtan uca yerel kullanım talimatı ve veri dışa aktarma
- [x] İzole veritabanında tam simülasyon smoke check'i: orkestratör, persona, imagegen, DB postu ve medya HTTP yanıtı
- [x] Son dokümantasyon commit/push (`69b06bc`)
- [ ] Deney raporu

Her sürümde tamamlanmayan iş backlog'da açık kalır; en yeni kayıt `backloglog.md` içine eklenir.
