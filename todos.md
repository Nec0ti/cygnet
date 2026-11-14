# Cygnet sürüm planı

## v0.1.0 — First Flight desktop release

- [x] Sandboxed Electron masaüstü kabuğu, loopback API ve kullanıcı veri klasörü.
- [x] Windows 10/11 x64 setup installer ve portable `.exe` (`windows-latest` native build).
- [x] Debian/Ubuntu x64 `.deb` ve Linux x64 AppImage builder çıktısı.
- [x] Tag ile sürüm paketlerini kuran ve GitHub Release oluşturan CI akışı.
- [x] Windows/Linux release workflow; Linux paket açılışı Xvfb smoke-testiyle doğrulandı.
- [x] `SHA256SUMS.txt` üretimi ve release asset digest'leri ile karşılaştırma.

Sürüm etiketi `v0.1.0`, başlık **First Flight**. Bu release imzasız preview olacak; Windows kod imzası yok. Ayrıntı `docs/releases/v0.1.0.md`.

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

- [x] Tarih aralığı seçilebilen özet rapor: post/story/DM, etkileşim, takip, report, görsel/üretim hatası ve persona aktivitesi; günlük seri ve persona kırılımı.
- [x] Raporu JSON ve CSV olarak dışa aktarma; CSV metinlerini spreadsheet formül enjeksiyonuna karşı güvenli kılma.
- [x] Rapor anındaki ayarları ve olay aralığını rapora iliştirme; rapor seçilen tarih aralığıyla sınırlı.
- [x] İzole DB'de tarih filtresi, metrik sayımı, dışa aktarma ve geçersiz aralık için self-check.

## 2.0 — keşif ve kontrollü deneyler

- [x] Persona aramasını ad, kullanıcı adı, bio, ülke ve pronouns alanlarında yapma; feed'i yeni/popüler/çok yorumlanan olarak sıralama.
- [x] Arama, sıralama, gezinme ve olay oynatımı için klavye ve ekran okuyucu erişimini iyileştirme.
- [x] Açıkça seçilmiş persona ID'leriyle iki kohortlu deney kaydı, ayar snapshot'ı ve kısa/ifadeci koşul karşılaştırması.
- [x] Olay günlüğünü zaman sırasıyla salt okunur oynatma; mevcut sosyal işlemleri yeniden çalıştırmama.
- [x] Persona cevaplarında yaş sınırı ve karakter kurallarının korunmasını self-check ile güvenceye alma.
- [x] Kontrollü deney, karşılaştırma ve salt okunur replay akışını izole DB/API'de doğrulama.

## 2.1 — profil ve deney sıfırlama

- [x] More menüsünden Activity archive, Simulation settings ve Research workspace alanlarına erişim.
- [x] AI profillerinde yerel raster portreleri ve insan profili için fotoğraf yükleme.
- [x] Sahte takipçi/takip edilen sayılarını kaldır; sayıları gerçek ilişki kenarlarından göster ve başlangıçta sıfırla.
- [x] Sosyal kişiliklerin takip eylemlerini orkestratör planına bağla.
- [x] Platform dakika sayısını yazarak çift onay isteyen ve ilk duruma döndüren reset akışı; insan profili fotoğrafını ve temel bilgilerini koru.
- [x] Aynı modüler kontrolleri, gerçek Chromium E2E akışlarını ve 100/1.000 profilli benchmark'ı yeni goal altında çalıştır; hataları düzelt ve raporla (`reports/2026-11-13-profile-reset-verification.md`).

## 2.2 — canlı görseller, story gizliliği ve admin

- [x] İlk 100 persona için 100 benzersiz raster portre; eski seed portrelerini migration ile değiştir.
- [x] Sonraki hesap avatarlarını, post/story görsellerini ve DM fotoğraflarını paylaşım/oluşturma anında Codex CLI imagegen ile üret.
- [x] AI–AI DM'lerde bağlama göre fotoğraf paylaşımını destekle; fingerprint'leri post ve mesajlar arasında kontrol et.
- [x] Story'leri insan ve AI tarafında takip grafiğine göre göster; blok ve süre dolumunu uygula.
- [x] More menüsüne admin alanı, varsayılan koyu tema, report/persona/content kontrolleri ve profil düğmesi durumlarını ekle.
- [x] Modüler testler, gerçek Chromium E2E 19/19, 100/1.000 benchmark ve sonuç raporu (`reports/2026-11-14-realtime-images-admin-verification.md`).

## 2.3 — boş başlangıç ve canlı persona feed'i

- [x] Yeni DB ve reset sonrası yalnız profiller/ilişkiler bulunsun; post ve story sayısı sıfır olsun.
- [x] Sabit seed post/story caption'larını kaldır; içerik yalnızca zamanlanmış orchestrator/persona aksiyonunda üretilsin.
- [x] Empty feed sırasında due like/comment aksiyonları hatasız biçimde beklemeye alınsın.
- [x] Seed, reset, simulator ve API self-check'leri ile gerçek Chromium akışını doğrula (20/20).
- [x] Benchmark'ı yenile ve bulguları `reports/2026-11-14-empty-launch-verification.md` altında kaydet.

## 2.4 — DM yanıtı, canlı yenileme ve görüldü

- [x] Gelen insan DM'lerini persona ritmine, kişilik özelliklerine ve simülasyon hızına göre yanıt için zamanla.
- [x] AI okuma kararını DM yanıtından ayır; AI mesajı görüldü bırakıp reply atmadan devam edebilsin.
- [x] İnsan DM yanıtını AI-AI DM başlatma ritminden ayır; pending reply için DM hedefini insana sabitle ve mevcut cevapsız mesajları migration ile kuyruğa al.
- [x] AI yanıtından sonra 60 saniye açık kalan DM devam penceresi ekle; pencere içindeki insan follow-up mesajını hemen due yapıp simulator tick'ini tetikle, zaman aşımında normal gecikmeye dön.
- [x] AI DM oluştururken sohbet ekranında persona adına göre typing göstergesi göster.
- [x] DM ekranı açıkken yeni mesajları yenile; conversation açılınca karşı mesajı read receipt ile kaydet.
- [x] AI'ın kendi mesajı görüldü ve yanıtsız kaldıysa, persona prompt'una uygun takip mesajı veya bekleme kararı ver.
- [x] API/read migration, kişilik yanıt zamanlaması, gerçek Chromium görüldü UI akışı ve tam check doğrulaması (`reports/2026-11-14-dm-seen-replies.md`).

## Yerel kullanım süresi, dayanıklılık ve benchmark

- [x] Sunucu açık süresini ve görünür/odaklı platform süresini ayrı, kalıcı SQLite sayaçlarında biriktir; restart aralıklarını sayma.
- [x] Birden çok açık tarayıcı sekmesinin platform süresini çift saymasını engelle; yedi birikimli gün için UI ilerlemesi göster.
- [x] Başlatma ve kapatmayı tek foreground komutta sun; izole launcher kontrolüyle iki servisin de kapandığını doğrula.
- [x] Tüm modül self-check'leri, HTTP action matrisi, kullanım restart akışı, web production build ve browser tracker lifecycle kontrolünü çalıştır.
- [x] 100 ve 1.000 profil için 10.000 ve 100.000 olaylık sentetik API benchmark'ı; JSON ve okunabilir Markdown sonuçlarını kaydet.

## Durum

- [x] Başlangıç dokümantasyonu ve ürün kararları
- [x] Sürüm yol haritası
- [x] Özel GitHub deposu ve başlangıç commit'i
- [x] MVP uygulaması
- [x] Codex CLI yerleşik `imagegen` ile bir deneme görseli üretme ve görseli kontrol etme
- [x] Codex CLI text/imagegen iş akışını Cygnet uygulamasına bağlama; görsel dosyası yerel medya klasörüne taşınmalı
- [x] Uçtan uca yerel kullanım talimatı ve veri dışa aktarma
- [x] İzole veritabanında tam simülasyon smoke check'i: orkestratör, persona, imagegen, DB postu ve medya HTTP yanıtı
- [x] Gerçek Chromium'da 14/14 tarayıcı E2E kontrol grubu: akış, post/story görseli, profil, takip, engel, DM, bildirim, araştırma ve deney ekranları
- [x] Codex CLI orkestratör + üç persona ile 12× hızda beş dakikalık (bir saat eşdeğeri) koşu; AI–AI DM, imagegen postu ve üç kişi eşzamanlılık sınırı doğrulandı
- [x] Son dokümantasyon commit/push (`69b06bc`)
- [x] 1.1 deney raporu araçları: JSON/CSV, ayar snapshot'ı, metrikler ve UI
- [x] 2.0 keşif, erişilebilirlik, kohort karşılaştırma ve salt okunur replay
- [ ] Yerel simülasyonu bir hafta çalıştırıp gerçek deney verisiyle raporu üretme
- [x] Profil fotoğrafları, gerçek takip sayıları, More menüsü ve çift onaylı reset için gerçek tarayıcı/API doğrulaması (Chromium 17/17)
- [x] 2.2 canlı görseller, story gizliliği, admin ve koyu tema; test ve benchmark raporu (`reports/2026-11-14-realtime-images-admin-verification.md`)
- [x] 2.3 boş başlangıç ve canlı persona feed'i; `./cygnet.sh check`, Chromium 20/20 ve 100/1.000 profil benchmark'ı (`reports/2026-11-14-empty-launch-verification.md`)
- [x] 2.4 DM yanıt zamanlaması, canlı yenileme ve kişilik bazlı görüldü tepkisi (`reports/2026-11-14-dm-seen-replies.md`)

Her sürümde tamamlanmayan iş backlog'da açık kalır; en yeni kayıt `backloglog.md` içine eklenir.
