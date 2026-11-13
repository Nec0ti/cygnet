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
- [x] Yeni yerel DB üzerinde migration, ayarlar, arşiv ve blok aşma uçtan uca kontrolü.

## 1.1 — deney raporu

- [ ] Tarih aralığı seçilebilen özet rapor: post/story/DM, etkileşim, takip, report, görsel ve persona aktivitesi; günlük seri ve persona kırılımı.
- [ ] Raporu JSON ve CSV olarak dışa aktarma; CSV metinlerini spreadsheet formül enjeksiyonuna karşı güvenli kılma.
- [ ] Rapor anındaki ayarları ve olay aralığını rapora iliştirme; bir haftalık gerçek çalışma verisi olmadan sonuç uydurmama.
- [ ] İzole DB'de tarih filtresi, metrik sayımı, dışa aktarma ve boş veri aralığı için self-check.

## 2.0 — keşif ve kontrollü deneyler

- [ ] Persona aramasını ad, kullanıcı adı, bio, ülke ve pronouns alanlarında yapma; feed'i yeni/popüler/çok yorumlanan olarak sıralama.
- [ ] Arama, sıralama, gezinme ve olay oynatımı için klavye ve ekran okuyucu erişimini iyileştirme.
- [ ] Açıkça seçilmiş persona ID'leriyle iki kohortlu deney kaydı, ayar snapshot'ı ve kohort etkinlik karşılaştırması.
- [ ] Olay günlüğünü zaman sırasıyla salt okunur oynatma; mevcut sosyal işlemleri yeniden çalıştırmama.
- [ ] Persona cevaplarında yaş sınırı ve karakter kurallarının korunmasını self-check ile güvenceye alma.
- [ ] Kontrollü deney, karşılaştırma ve salt okunur replay akışını izole DB/API'de doğrulama.

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
- [ ] 1.1 deney raporu araçları ve gerçek bir haftalık çalışma verisi
- [ ] 2.0 keşif, erişilebilirlik, kohort karşılaştırma ve salt okunur replay

Her sürümde tamamlanmayan iş backlog'da açık kalır; en yeni kayıt `backloglog.md` içine eklenir.
