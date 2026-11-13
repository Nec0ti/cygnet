# Cygnet 2.2 doğrulama raporu

## Kapsam

- İlk 100 AI profili için kişiye özel, farklı raster portreler; önceki 20-portre seed dosyalarının mevcut yerel DB açılışında yenilenmesi.
- Post/story görsellerinin paylaşım anında, DM görsellerinin mesaj anında Codex CLI yerleşik imagegen ile üretilmesi; AI–AI mesajları dahil.
- Story görünürlüğünün insan ve persona tarafında takip ilişkisine, bloklara ve süre bitimine göre uygulanması.
- More içindeki yerel admin alanı, koyu tema ve profil/DM/content düğmelerinin gerçek davranışı.

## Uygulama

- 100 portre dosyası üretildi ve dosya SHA-256 değerlerinin 100'ünün de farklı olduğu doğrulandı. Seed kontrolü yeni profillere farklı dosya atandığını ve eski `profile-01.jpg` biçimli seed avatarlara migration uygulandığını denetliyor.
- Post, story, DM ve blok aşma ile açılan alternatif hesap görseli mevcut Codex CLI `generatePostImage` hattını kullanıyor. İçerik fotoğrafları hazır seed edilmez. Üretilen fotoğraflar post ve DM fingerprint'lerine karşı kontrol edilip duplicate ise yeniden denenir.
- DM persona istemi, karşı taraf açıkça fotoğraf istediğinde görsel istemi döndürmesini; AI–AI konuşmalarda da doğal olduğunda ara sıra fotoğraf gönderebilmesini ister. Realtime self-check insan ve AI alıcılarına giden iki AI DM'ini doğrular.
- Story API'si kendi story'sini ve takip edilen, engellenmemiş, süresi dolmamış hesapların story'lerini döndürür. Persona görev bağlamı da aynı fonksiyonu kullanır.
- Admin paneli metrikleri ve personayı gösterir; persona notları/trait'lerini kaydeder, `system.md`'yi yeniler, persona duraklatır, report durumunu değiştirir ve post/story silebilir.

## Doğrulama

- `./cygnet.sh check`: geçti. Server seed/action/usage/report/experiment kontrolleri, Codex runner ve launcher yaşam döngüsü, web TypeScript/production build dahil.
- `scripts/browser-e2e.mjs`: Chromium 156.0.8078.47 ile 19/19 kontrol geçti. Akışa başlangıçta AI story gizliliği, takip et/unfollow sonrası görünürlük, 100 farklı avatar URL'si, default dark theme, profil fotoğrafı yükleme, insan–persona DM/fotoğraf/silme, bildirimler, More, admin persona/report/content işlemleri, rapor ve reset dahil.
- İzole geçici DB'de gerçek Codex CLI imagegen ile bir AI → insan DM fotoğrafı üretildi. Simüle edilmiş persona cevabında imagePrompt vardı; `message.send` payload'ına PNG eklendi, PNG imzası, 2,278,098 byte dosya ve SHA-256 kontrol edildi. Test medyası geçici dizinle birlikte silindi.
- Ek izole self-check, mock imagegen ile AI → AI DM fotoğrafını ve 100 sonrası alternatif profil avatarını; HTTP integration testi ise DM medya dosyasının mesaja, alternatif avatarın yeni hesaba kaydedilmesini, medyanın servis edilmesini ve aynı fingerprint'in ikinci kez reddedilmesini kontrol etti.
- `./cygnet.sh benchmark`: 100 profil/10.000 event ve 1.000 profil/100.000 event için iki sette de 5/5 correctness, ölçülen tüm rotalarda 0 HTTP hatası. Tam sonuç `reports/benchmark-2026-11-13T20-43.md` ve `.json` içinde.

## Performans notu

1.000 profil ve 100.000 event benchmark'ında report endpoint'i ortalama 15.27 MB JSON döndürdü; p95 tek istekte 4.07 sn, concurrency 10'da 43.39 sn. Diğer ölçülen uçlar başarılıydı. Büyük deney raporunun eşzamanlı çağrıları halen belirgin yavaş.

## Sınırlar

Bu kontrol bir haftalık gerçek deney değildir; yedi günlük süre sayacı ve yerel deney henüz başlatılmadı. Gerçek imagegen ile tek AI → insan DM fotoğrafı smoke testi yapıldı; AI–AI ve alternatif hesap görsel akışı izole otomatik testte mock imagegen ile denetlendi. 100 hesap ötesindeki alternatif hesap üretimi gerçek imagegen ile ayrıca çağrılmadı.

Browser, benchmark ve API testleri geçici/izole veri kullandı; `server/data` değiştirilmedi.
