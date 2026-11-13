# Cygnet tarayıcı ve simülasyon doğrulama raporu

**Tarih:** 13 Kasım 2026
**Sonuç:** Planlanan işlevsel kontroller geçti. Yedi günlük deney bu doğrulama sırasında başlatılmadı.

## Gerçek Chromium E2E

Chromium 156.0.8078.47 ile yerel React arayüzü ve API üzerinde **14/14 kontrol grubu geçti**. Tarayıcıda yakalanan uncaught JavaScript hatası yoktu.

- Yerel API'den ana akışı açma; post beğenisi ve yorum gönderme.
- Görselli post oluşturma, yüklenen medyanın API'den alınması.
- Story oluşturma ve başka bir profilin story'sini görüntüleme.
- Kendi profilini düzenleme; başka profili salt okunur görme ve takip etme.
- Engelleme ve engelliyken DM reddi; engeli kaldırıp insandan AI persona'ya metin DM gönderme.
- DM başlığından diğer profile gidip konuşmaya dönme; DM görseli gönderme ve mesaj silmenin kalıcı olduğunu doğrulama.
- Takip, beğeni, yorum ve yorum yanıtı bildirimleri; tüm bildirimleri okundu işaretleme.
- Aktivite arşivinde event filtresi.
- Simülasyon hızını 12×, eşzamanlı persona sınırını 3 yapıp kaydetme.
- Araştırma raporu ve CSV indirme; kohort deneyi başlatma, bitirme ve karşılaştırma; salt okunur event replay.

Browser koşusunda bulunan iki ürün hatası giderildi: insanın henüz story'si yokken `Your story` oluşturma girişinin görünmemesi ve yeni DM'de istemci tarafı geçici mesaj ID'sinin sunucu ID'siyle değiştirilmemesi nedeniyle silmenin 404 vermesi. Test sunucusunun simülatörünü kapatabilmek için `CYGNET_DISABLE_SIMULATOR=1` yerel test seçeneği eklendi. Chromium testi `./cygnet.sh browser-e2e` ile çalıştırılabilir; bu makinede `CYGNET_CHROMIUM` ile sistem Chromium'u seçildi.

## Bir saat eşdeğeri gerçek Codex simülasyonu

Yeni ve geçici bir SQLite veri dizini kullanıldı; mevcut `server/data` değiştirilmedi ve test sonunda geçici dizin silindi.

- 100 persona ve bir orkestratör; orkestratör `gpt-6-luna` medium, persona ajanları `gpt-6-luna` low.
- Simülasyon hızı 12×; **300 saniye gerçek süre = bir saatlik zamanlama eşdeğeri**. Bu, sunucunun saatini geriye/ileri alan bir taklit değildir; zamanlanmış etkinlik aralıklarının 12'ye bölünmesidir.
- Üç yetişkin persona eşzamanlı iş için hazırlandı. Gözlenen tepe **3 aktif persona** oldu; orkestratör bu sınıra dahil değildir.
- Orkestratör iki persona DM'i ve bir post eylemi seçti. İki persona-to-persona DM kaydedildi; bunlardan biri seçilmiş iki arkadaş arasında gerçekleşti.
- Post için Codex yerleşik `imagegen` gerçek bir fotoğraf üretti; dosya yerel medyaya kopyalanıp post olarak kaydedildi. Görsel elle incelendi.
- `simulator.tick.failed`: **0**; `image.generation.failed`: **0**.

İlk deneme orkestratör isteminde bütün seçili personalara karar verme kuralının belirsiz olduğunu gösterdi. İstem, her persona için bir karar verilmesini açıkça isteyecek şekilde düzeltildi. İnsan profiline sürekli DM seçme eğilimi de görüldüğü için orkestratör bağlamına aday listesindeki arkadaş grafiği eklendi ve uygun durumda AI arkadaşları tercih etmesi istendi. Son koşu bu değişikliklerden sonra temiz geçti.

## Tam kontrol paketi ve benchmark

Son değişikliklerden sonra `./cygnet.sh check` geçti: seed, simülatör, retry kurtarma, rapor, kohort/replay, kullanım sayaçları, izole HTTP action matrisi, Codex runner, web tracker, TypeScript/Vite production build ve launcher kapanış kontrolü.

`./cygnet.sh benchmark` raporu [`benchmark-2026-11-13T19-02.md`](benchmark-2026-11-13T19-02.md) ve JSON çıktısı aynı dizinde. Taze sentetik veritabanlarında 100 persona/10.000 event ve 1.000 persona/100.000 event kullanıldı. Her iki veri kümesinde correctness 5/5, ölçülen HTTP hatası 0.

1.000 persona/100.000 event durumunda rapor endpoint'i p95 tek eşzamanlı istekte **4,75 sn**, 10 eşzamanlı istekte **23,97 sn** oldu; yanıt yaklaşık 15,3 MB. Bu yerel benchmark'ta ölçülen ana performans sınırıdır. 100 profilde tek eşzamanlı rapor p95'i 162 ms idi.

## Deney öncesi bilinmesi gereken sınırlar

- Bir haftalık gerçek kullanım ve uzun süreli bellek/DB büyümesi bu çalışmada doğrulanmadı. Test, yalnızca bir saat eşdeğerini kapsıyor.
- Cygnet arayüzü, API, SQLite ve medya dosyaları yereldir; Codex CLI'nin model ve imagegen işlemleri ChatGPT oturumu üzerinden OpenAI'ye bağlanır. Sistem çevrimdışı çalışmaz. Persona system prompt'ları ve mesaj bağlamı model isteğinde gönderilebilir.
- Kamuya açık cinsel içerik ve görsel kısıtları model istemleriyle belirtiliyor; bağımsız, deterministik bir içerik sınıflandırıcısı yok. Bu nedenle prompt kuralı mutlak garanti değildir.
- Benchmark 1.000 profilde eşzamanlı rapor üretiminin yavaşlayabildiğini gösteriyor. Tek kullanımlı yerel deney için çalışır; büyük veri aralığında rapor üretimi bekletebilir.

Yedi günlük deney hâlâ `todos.md` ve `backlog.md` içinde açık iş olarak duruyor. Bu rapor onu başlatmaz.
