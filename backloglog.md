# Backlog günlüğü

> Serbest çalışma günlüğü. En yeni kayıt en üstte; backlog'daki iş sırası ve durumu `backlog.md` dosyasındadır.

## 2026-11-14 — bildirim takibi ve public desktop release hazırlığı (devam ediyor)

- Follow bildirimi kartı takip işleminden sonra da sabit `Follow` gösteriyordu. Etiket artık `followedByMe` state'ini izliyor; Chromium akışı Follow → Following → Follow durumlarını denetliyor.
- README public kullanıcılar için yenilendi; mimari, model veri işleme, güvenlik sınırı ve contribution belgeleri eklendi. Demo fallback profili gerçek kullanıcı adından genel bir örneğe çevrildi.
- İlk desktop sürüm: `v0.1.0 — First Flight`. Electron kabuğu mevcut React UI ve API'yi tek pencerede çalıştırıyor; data OS user directory'ye yazılıyor. Windows portable data'yı `Cygnet-data/` içine, exe yanına koyuyor.
- Release builder hedefleri: Windows 10/11 x64 NSIS setup + portable exe; Linux x64 `.deb` + AppImage. Codex CLI kimliği pakete gömülmüyor. Tag workflow'u Linux verify'dan sonra OS runner'larında build edip SHA-256 checksum'larla Release oluşturuyor.
- Güvenlik: generated package lock'ı sıfır npm audit açığıyla sabitle; `server/data/`, .env, build output ve release output Git dışında kalmalı. İlk taramada eski committe demo profil adı bulundu; publish öncesi main history'den de temizlenmeli.
- Linux x64 AppImage ve `.deb` NixOS ortamında üretildi; `.deb` builder bu host'ta `libcrypt.so.1` uyumluluk kütüphanesi ile çalıştırıldı. Windows artifactleri GitHub `windows-latest` doğrulamasını bekliyor.
- Kod kontrolleri: `./cygnet.sh check` geçti; gerçek Chromium 156 E2E 22/22 geçti. Public visibility değiştirilmeyecek; release ve history cleanup doğrulandıktan sonra kullanıcıya aktarılacak.

## 2026-11-14 — DM devam penceresi ve hızlı cevap (tamamlandı)

- Kullanıcı, yeni DM yanıtlarının çok yavaş olduğunu ve aynı sohbet sürerken sonraki mesajların anında yanıtlanmasını; bir dakika sessizlikten sonra sohbet temposunun kapanmasını istedi.
- Tasarım: AI insana DM gönderince gerçek zamanlı 60 saniyelik aktif sohbet penceresi açılır. İnsan bu sürede cevap yazarsa persona DM yanıtı hemen due olur, simülatör tick'i tetiklenir ve devam yanıtı AI hedef seçimine bırakılmaz. Süre aşılırsa yeni mesaj eski kişilik/simülasyon gecikmesini kullanır.
- `requestTick()` çalışan simülatör turu varsa tur sonrasına tek ek tur kuyruğa koyar; sohbet hızlı yanıtı rutin 60 saniyelik tick'i beklemez.
- Doğrulama: `./cygnet.sh check` geçti; Chromium E2E 21/21 geçti. Entegrasyon check'i 60 saniyelik aktif pencere ve hemen due follow-up'ı, simulator self-check'i aktif pencerede zorunlu cevap ve süre aşımında bekleme kararını doğruladı.
- Deney verisi sıfırlanmadı; `reports/2026-11-14-dm-continuation-window.md`. Kodun çalışan sürece geçmesi için normal restart gerekli.

## 2026-11-14 — İnsan DM yanıtını AI-AI DM'den ayırma (tamamlandı)

- Kullanıcı dört AI'ya sade selam verdi; hepsi okudu, ancak insan konuşmalarında yanıt görünmedi.
- Yerel DB incelemesi yanıt zamanlayıcısının bazı persona DM eylemlerini başka AI'lara yönelttiğini ve `last_dm_at` alanının bekleyen insan yanıtını kapatmış gibi gösterdiğini doğruladı. Bu normal persona sessizliği değil, DM yönlendirme/planlama hatası.
- Ayrı `human_reply_due_at` alanı, pending insan mesajlarını normal DM ritminden ayırır. Orkestratör DM seçerse hedef insana sabitlenir; `wait` seçeneği korunur. İnsan mesajlarına yanıt gelmeden kalmış eski konuşmalar migration sırasında sıraya alınır.
- Doğrulama: `./cygnet.sh check` geçti; Chromium E2E 21/21 geçti. İzole simulator self-check, orkestratör başka AI'ı hedeflese bile pending insan yanıtının insana gittiğini; API entegrasyonu schedule/clear davranışını ve migration self-check cevapsız eski mesajı koruyarak sıraya almayı doğruluyor.
- Canlı `server/data/` sıfırlanmadı veya bu düzeltme için durdurulmadı. Kodun aktif sürece geçmesi için kullanıcı uygulamayı normal şekilde yeniden başlatmalı.
- İlgili rapor: `reports/2026-11-14-dm-reply-routing.md`.

## 2026-11-14 — AI görüldü eylemini DM yanıtından ayırma (tamamlandı)

- Kullanıcı netleştirdi: AI mesajı görüldü bırakabilir; cevap vermesi zorunlu olmamalı.
- Mevcut akışta AI read receipt yalnız `dm` assignment'ı sırasında oluşuyordu. Ayrı due/read aksiyonu ile AI konuşmayı açıp `read_at` kaydedebilecek, sonraki DM yanıtı ayrı planlanacak.
- Kapsam: persona başına ayrı `read_due_at`; read eylemi konuşmadaki unread mesajları görür ama DM göndermez; sonraki DM kararı kişilikle uyumlu kalır; izole test/API/browser akışlarını güncelle.
- Mevcut deney verisini resetleme.
- Tamamlandı: migration, bağımsız read assignment ve kendine ait zamanlama eklendi; entegrasyon self-check'i gelen DM için okuma ile yanıtın ayrı schedule edildiğini doğruluyor.
- Doğrulama: `./cygnet.sh check` geçti; gerçek Chromium E2E 21/21 geçti. Simülatör self-check'i `read` eyleminin okundu kaydedip DM üretmediğini doğruladı.
- İlgili rapor: `reports/2026-11-14-dm-seen-replies.md`.

## 2026-11-14 — DM typing göstergesi (tamamlandı)

- Kullanıcı isteği: AI cevap oluştururken DM ekranında `typing...` bilgisi göster.
- Persona insan hesabına DM üretirken `typing_until` başlatılır; bootstrap ve açık sohbetin beş saniyelik yenilemesi bunu UI'a taşır. Simülatör turu bitince durum temizlenir; eski DB'lere kolon migration ile eklenir.
- Doğrulama: `./cygnet.sh check` geçti; Chromium E2E 21/21 geçti; simülatör self-check typing durumunun üretim sırasında açık, tur sonunda kapalı olduğunu doğruladı.
- İlgili rapor: `reports/2026-11-14-dm-seen-replies.md`.

## 2026-11-14 — DM yanıt ritmi ve görüldü bilgisi tamamlandı

- Kullanıcı: AI takipleri başlıyor ama DM cevaplarının görünürlüğü/yanıtı belirsiz; DM arayüzüne görüldü bilgisi ve kişiliğe uygun “seen” tepkisi eklensin.
- İlk inceleme: mesajlaşma ekranı yeni AI mesajlarını canlı yenilemiyor; sadece ilk `only_after_contact` kişilikleri inbound DM'yi due kabul ediyor, diğer kişiliklerde inbox DM'si 6/36 saatlik outbound schedule'ı bekliyor. Postlar 4–8 saatlik, storyler saatlik due zamanlı; bu reset sonrası başlangıçta boş olmaları beklenen davranış.
- Kapsam: gelen DM'lere persona ritmine göre ayrı yanıt zamanı; açık conversation polling; persistent message read timestamp; insan okuyunca görüldü göstergesi; AI kendi DM planı sırasında okuyunca karşı taraf için read receipt; AI'nin kendi mesajı görüldü ve yanıtsız kalırsa kişilik bazlı, düşük baskılı takip mesajı şansı.
- Mevcut kullanıcı verisini resetleme.
- Uygulandı: DM yanıt zamanı 2–35 dakika arasında persona utangaçlığı/sosyalliği/dürtüselliği ve simülasyon hızına göre hesaplanır. DM sayfası açıkken 5 saniyede bir yenilenir. `messages.read_at` ve `accounts.seen_due_at` migration'ları mevcut DB'lere konuşmaları bozmadan eklenir.
- İnsan DM'i açınca AI mesajı görüldü kaydedilir; AI DM aksiyonu işlerken karşı mesajı okur. AI'nin mesajı görüldü ve yanıtsız kaldıysa sonraki DM prompt'u kişiliğe göre nazik bir takip veya bekleme seçeneği verir.
- Doğrulama: `./cygnet.sh check` geçti; Chromium 156 E2E 21/21; integration check gecikmeli DM yanıtını, iki yönlü read receipt ve üye olmayan okuma reddini doğruladı. Benchmark yapılmadı; ağır sorgu yolunda değişiklik yok.
- Rapor: `reports/2026-11-14-dm-seen-replies.md`. `server/data` değiştirilmedi. Çalışan uygulama yeni schema ve UI için yeniden başlatılmalı.

## 2026-11-14 — Geçersiz orkestratör hedefi ve retry kilidi düzeltildi

- Kullanıcı admin panelinde `Plan references an invalid account`, `0 active personas`, `0 queued` gördü. Canlı API'den salt okunur durum kontrolü hata metnini doğruladı.
- Bir geçersiz/self DM-follow hedefi bütün tick planını doğrulama öncesinde durduruyordu; seçilen ajanlar retry backoff'a girdiği için aktif ve kuyruk 0 görünüyordu. Başarısız model cevabındaki hedef saklanmadığından exact hedef id sonradan belirlenemedi.
- Orkestratör prompt'u kendini ve listede olmayan hesabı hedeflememesi için netleştirildi. Geçersiz/self/engelli DM-follow güvenli `wait` olur; böylece diğer atamalar çalışabilir. Sunucu yeniden açılırken önceki `Plan references an invalid account` retry durumu temizlenir.
- `node server/src/simulator-retry-self-check.js` ve `./cygnet.sh check` geçti. Ayrıntı `reports/2026-11-14-invalid-orchestrator-target.md` içinde.
- Çalışan deney DB'si okunup yazılmadı; gerçek test tarayıcısındaki sürecin yeni kodu alması için uygulamayı yeniden başlatmak gerekiyor.

## 2026-11-13–14 — Görsel özgünlüğü, story gizliliği, admin ve koyu tema tamamlandı

- Kullanıcı görsel çeşitliliği ve kişiye özel fotoğraflar, takipçi tabanlı story görünürlüğü, admin paneli, işlevsiz düğmelerin düzeltilmesi/kaldırılması ve sonradan eklenen varsayılan dark theme istedi.
- Netleştirilen görsel kuralı: ilk 100 profil portresi seed görseli olabilir; her portre benzersiz. Sonraki hesapların avatarı, ayrıca her post/story/DM fotoğrafı paylaşım anında Codex CLI yerleşik `imagegen` ile üretilir. AI–AI DMs de fotoğraf paylaşabilir. Önceden hazırlanmış post/story/DM görseli yok.
- Uygulandı: ilk 100 için 100 benzersiz raster portre; mevcut eski seed avatarlarını bir sonraki açılışta yenileyen migration; post/story canlı imagegen çeşitlilik istemleri ve post+DM fingerprint tekilliği; DM imagePrompt gelirse fotoğraf üretip mesaja ekleme; blok sonrası yeni hesapta avatarı canlı üretme.
- Uygulandı: takip/blok/sona erme şartlarıyla story görünürlüğü; persona bağlamında da aynı görünürlük kuralı. More menüsünde yerel admin paneli, default dark theme ve pasif/yanıltıcı profil kontrolü düzeltmeleri.
- 100 portre SHA-256 bazında benzersiz. Existing DB'deki eski `profile-01.jpg` seed avatars bir sonraki server açılışında yeni `profile-001.jpg`… biçimine migrate edilir. AI content image pre-generation yok.
- Doğrulama tamamlandı: `./cygnet.sh check` geçti; Chromium 156 E2E 19/19; izole gerçek Codex CLI imagegen DM smoke PNG/sha kontrolü geçti; story follow/block/expiry self-check geçti; 100/1.000 profilli benchmark iki ölçekte de 5/5 doğruluk ve sıfır HTTP hatası verdi.
- Admin E2E ilk koşusu `.map(accountView)` callback indeksinin yanlışlıkla sayaç parametresi olmasını yakaladı; callback açık parametreye çevrildi. İlk yeni DM integration check AI–AI konuşmasının insan bootstrap listesinde olmadığını varsaymıştı; assertion yerel export'a alındı.
- 1.000 profil/100.000 event benchmark'ında report concurrency 10 p95 43.39 sn, yanıt 15.27 MB, RSS 647.8 MB; ölçülen belirgin performans sınırı olarak not edildi. Sonuç `reports/benchmark-2026-11-13T20-43.md` ve `reports/2026-11-14-realtime-images-admin-verification.md` içinde.
- Browser, benchmark, imagegen-smoke ve API testleri izole/geçici data kullandı; `server/data` değiştirilmedi. Yedi günlük deney başlamadı.
- Sıradaki: kullanıcı `./cygnet.sh` ile yerel deneyi başlatıp birikimli platform süresi yedi güne ulaşınca durdursun.

## 2026-11-13 — Profil ve reset özelliklerinin test/benchmark doğrulaması

- `./cygnet.sh check` geçti: server self-check ve HTTP integration, simulator/runner/seed, usage tracker lifecycle, web TypeScript+production build ve launcher lifecycle.
- Gerçek Chromium 156 E2E 17/17 geçti. Yeni akışlar; ilk profil sayılarının sıfır ve avatar görsellerinin HTTP 200 olması, insanın fotoğraf yüklemesi, takipten sonra iki taraflı sayaçların artması, masaüstü/mobil More menüsü ve resetin dakika yazma şartı ile insan profilini koruyup seed veriye dönmesi.
- `./cygnet.sh benchmark` 100 profil/10.000 event ve 1.000 profil/100.000 event için 5/5 correctness, 0 HTTP hatası verdi. Bootstrap toplu takip sayımı ile düzenlendi; 1.000 profil concurrency 10 bootstrap p95 bu koşuda 2,63 sn oldu.
- 1.000 profil rapor endpoint'i concurrency 10'da p95 44,01 sn ve ortalama 15,27 MB JSON döndürdü; server RSS 718,8 MB. Bu ağır sentetik rapor yükünde performans sınırı mevcut; tek istek p95 4,00 sn. Ayrıntı `reports/benchmark-2026-11-13T19-59.md` ve `.json` içinde.
- Bir ilk build denemesi reset modalındaki TypeScript union daraltma hatasını buldu; düzeltildi. İlk E2E reset sayacı kontrolü canlı saatin sıfırlamadan hemen sonra yeniden ilerlemesini yanlışlıkla hata sayıyordu; beklenti resetten sonraki ilk saniye olarak ayarlandı ve tüm Chromium akışı tekrar geçti.
- Bütün test ve benchmark verileri geçici dizinlerdeydi; `server/data` üzerinde reset/temizleme yapılmadı. Gerçek Codex ile yeni bir saatlik simülasyon ve yedi günlük deney bu turda çalıştırılmadı.
- Sıradaki: yedi günlük yerel deneyi kullanıcı başlatsın; platform sayacı yedi birikimli güne erişince durdurup raporla.

## 2026-11-13 — Profil, takip sayıları ve güvenli deney sıfırlama uygulaması

- More menüsüne Activity archive, Simulation settings, Research workspace ve Reset simulation girişleri eklendi.
- 20 yerel raster portreden AI profillerine avatar atandı; profil düzenleme penceresinden insan fotoğrafı yükleme eklendi. Var olan SQLite hesapları sonraki normal açılışta avatar migration'ı ile güncelleniyor; mevcut deney kayıtlarına dokunulmadı.
- Profil takipçi/takip edilen sayıları `edges` tablosundan hesaplanıyor; yapay başlangıç sayıları kaldırıldı. Orkestratör, sosyal persona takipleri için insan profilini seçenek olarak değerlendiriyor.
- Reset iki onay ve ekranda görünen birikmiş platform dakikasını tam yazma şartı istiyor; aktif simülatör tick/persona işi varken reddediliyor. Reset; seed popülasyonu, sosyal/deney geçmişi ve iki kullanım sayacını sıfırlıyor, insan profil bilgileri ve fotoğrafını koruyor.
- Bu uygulama turunda test veya benchmark çalıştırılmadı; kullanıcı isteği uyarınca tüm doğrulama kod değişiklikleri tamamlandıktan sonra yeni goal altında yapılacak.
- Sıradaki: yeni goal aç; mevcut `./cygnet.sh check`, gerçek Chromium E2E ve `./cygnet.sh benchmark` kapsamını yeni özellikleri de kapsayacak biçimde çalıştır, sorunları düzeltip raporla. Gerçek `server/data` üzerinde reset çalıştırma.

## 2026-11-13 — Gerçek tarayıcı ve bir saat eşdeğeri simülasyon doğrulaması

- Gerçek Chromium E2E'si 14/14 kontrol grubu geçti. Test akışları profil düzenleme/görüntüleme, takip, post/story görseli, beğeni/yorum/bildirim, DM profili, medya eki/silme, rapor/CSV, kohort ve replay'i kapsıyor.
- E2E, boş story başlangıcındaki oluşturma girişinin eksik olduğunu ve DM silmede istemci geçici ID'sinin sunucu ID'sine çevrilmediğini buldu; iki kusur düzeltildi.
- Gerçek Codex CLI ile 12× hızda 300 saniye çalıştırma bir saatlik zamanlama eşdeğerine ulaştı. 100 persona içinde en çok üç persona agent çalıştı; orkestratör bu sınıra dahil değil. Son koşuda iki AI–AI DM, bir imagegen postu, sıfır simülatör hatası ve sıfır görsel üretim hatası gözlendi.
- Orkestratör istemindeki eksiksiz atama kuralı açıklaştırıldı; test edilen arkadaş grafiği uygun DM hedefi bağlamı olarak eklendi. Görsel gerçek PNG olarak üretildi ve elle incelendi.
- `./cygnet.sh check`, production build ve launcher kontrolü tekrar geçti. Güncel 100/1.000 persona benchmark'ında ölçülen istek hatası yok; 1.000 persona/100.000 event rapor p95'i tek istekte 4,75 sn ve 10 eşzamanlı istekte 23,97 sn (`reports/benchmark-2026-11-13T19-02.md`).
- Tam ayrıntı ve sınırlar `reports/2026-11-13-browser-simulation-verification.md` içinde. Simülasyon, browser E2E ve benchmark geçici verileri silindi; `server/data` değiştirilmedi. Yedi günlük deney başlatılmadı.
- Rapor ve doğrulama kodu `0cc2b50` ile private `main`e gönderildi. Yedi günlük deney başlatılmadı.
- Sıradaki: kullanıcı `./cygnet.sh` ile yerel deneyi başlatıp birikimli platform süresi yedi güne ulaşınca durdursun.

## 2026-11-13 — Kalıcı süre ölçümü, test ve benchmark çalışması

- Kalıcı sunucu çalışma süresi ve sekme odaklı platform kullanım süresi SQLite'a checkpoint ile kaydediliyor; birden fazla açık sekme platform süresini çifte saymıyor.
- İzole kullanım saati ve HTTP entegrasyon kontrolleri eklendi. Test, mesaj silme işleminde SQLite string literal hatası buldu; düzeltildi.
- `./cygnet.sh` tek komut launcher'ı açılıp kapandı; `./cygnet.sh check` tüm server, engine, seed, browser tracker, entegrasyon ve production build kontrollerini geçti.
- `server/npm run benchmark`, geçici DB'de 100/1.000 profil, 10 bin/100 bin synthetic event ve 1/10 paralel istekleri ölçtü. İkinci koşuda tüm endpoint'ler 2xx ve iki sette de correctness 5/5 oldu.
- 1.000 profilde report p95 tek istekte 5.02 sn, concurrency 10'da 38.99 sn; 15.27 MB yanıt üretiyor. Bu ölçülen darboğaz rapora yazıldı. İlk 20'şer ağır endpoint örneklemesi 6 HTTP hatası vermişti; bootstrap/report için örneklem 10'a indirilip tüm benchmark tekrar çalıştırıldı ve hatasız tamamlandı.
- Kullanım verisi, test DB'leri ve benchmark DB'leri `server/data` dışında tutuldu; gerçek `server/data` değiştirilmedi.
- Değişiklikler `ad33a7d` ile commit/push edildi; `git ls-remote` private `origin/main` SHA'sını aynı gösterdi ve çalışma ağacı temizdi.
- Sıradaki: `./cygnet.sh` ile yerel deneyi dönem dönem çalıştır; platform süresi 604.800.000 ms olduğunda durdur ve gerçek yedi günlük raporu üret.

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

## 2026-11-14 — Boş platform başlangıcı ve canlı ilk içerik tamamlandı

- Kullanıcı reset sonrası hiçbir AI hesabında önceden paylaşılmış post/story olmamasını, platformun yeni açılmış gibi yalnızca profiller, bio, pronoun ve profil ilişkileriyle başlamasını istedi. Persona hesapları/profil dosyaları her resetle yeniden oluşturulacak.
- Root cause: `server/src/seed.js` her fresh DB ve reset sırasında sabit caption listesinden 28 post ve 12 story üretiyor. Simülatör zaten persona kararından sonra post/story metni ve görselini canlı üretiyor; bu yolu koru.
- Kapsam: sabit içerik seed'ini kaldır; boş feed durumunda etkileşim aksiyonlarını sağlamlaştır; seed/API/browser reset kontrollerini güncelle; README ve proje kayıtlarını senkronize et; izole check, Chromium E2E ve benchmark çalıştırıp raporla.
- Gerçek `server/data` ve yedi günlük deney verisine dokunma. Doğrulama geçince commit/push et.
- Uygulandı: seed/reset artık yalnızca profilleri, portreleri ve başlangıç arkadaşlık grafiğini oluşturuyor. Sabit 28 post/12 story eklentisi kaldırıldı. Due like/comment, feed boşken orkestratöre sunulmuyor; due paylaşım post/story'yi persona runner ve imagegen hattından geçiriyor.
- Doğrulama: `./cygnet.sh check` geçti; gerçek Chromium 156 E2E 20/20; simulator self-check canlı post/story dispatch'ini doğruladı. Benchmark 100/1.000 profil ve 10k/100k event için 5/5 correctness, sıfır HTTP hatası verdi.
- Benchmark notu: 1.000 profil report p95 concurrency 10'da 37,11 sn, bootstrap p95 3,12 sn. Ayrıntı `reports/benchmark-2026-11-13T21-19.md` içinde.
- Sonuç raporu: `reports/2026-11-14-empty-launch-verification.md`. Testler geçici DB kullandı; `server/data` ve gerçek deney değişmedi. Yedi günlük deney başlamadı.
- Sıradaki: kullanıcı yeni kodla çalışan sunucuyu yeniden başlatıp çift onaylı reseti bir kez uyguladığında, temiz profillerle boş feed üzerinden deneye başlayabilir.
