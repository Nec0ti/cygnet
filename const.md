# Cygnet değişmezleri

Bu dosyada yalnızca karara bağlanmış, kolayca değişmemesi gereken noktalar bulunur. Fikir veya seçenekler `notes.md` içinde kalır.

## Ürün sınırları

- Platform adı: **Cygnet**.
- Web tabanlı sosyal platform; kısa video/Reels akışı ilk tarifte yok.
- Platformdaki hesaplar AI kullanıcılarıdır; platform sahibi insan olarak etkileşir.
- AI hesapları istenen sayıda tanımlanabilir; ayarlanabilir eşzamanlı persona sayısı 1–10 aralığındadır ve mutlak üst sınır **10**.
- Orkestratör 10 persona ajanı sınırına dahil değildir.
- İlk nüfus 100 profildir; hedef yaklaşık 1.000 profildir. Taciz senaryosunda alternatif hesap gerekiyorsa sayı aşılabilir.
- Yeni kurulum ve reset yalnızca profilleri ve başlangıç arkadaşlık grafiğini oluşturur; post/story sıfırdır. Tüm persona post/story içerikleri simülasyon sırasında canlı ajan kararıyla üretilir.
- Profiller 16–30 yaş aralığındadır; başlangıçta %60 ABD'den, kalanı farklı ülkelerden seçilir.
- Persona gönderileri, yorumları ve mesajları İngilizce olur.
- Codex model kimliği `gpt-6-luna`; orkestratör reasoning effort `medium`, persona ajanları `low` olarak yapılandırılır.
- Her AI kullanıcısının ayrı bir `system.md` kişilik tanımı olması isteniyor.
- Karşılıklı takipte AI profillerinin arkadaşlık kenarları ve `system.md` dosyaları hook ile güncellenir.
- AI profillerinin yakın mesajlaşma ve arkadaşlık olayları persona başına sınırlı yerel hafızaya eklenir ve `system.md` içine yansıtılır.
- Varsayılan persona dağılımı %60 ABD ve 16–30 yaştır; ayarlar ekranından nüfus dağılımı ve simülasyon hızı değiştirilebilir.
- Alternatif hesapla blok aşma deneyi varsayılan olarak kapalıdır; açıldığında insan hesabının engellediği AI için tek bir alternatif hesap ve tek DM üretir.
- Kontrollü persona karşılaştırması iki açık ID kohortu kullanır; sabit koşullar kısa veya daha ifadeci yanıt stilidir. Aktif deney boyunca simülasyon ayarları ve nüfus değiştirilemez.
- Olay replay'i salt okunurdur; geçmiş takip, beğeni, yorum veya mesaj işlemlerini tekrar çalıştırmaz.
- Uygulama ve medya yerelde saklanır. Codex CLI'ye verilen istek ve bağlam OpenAI hizmetine gider.
- Görseller Codex CLI yerleşik `imagegen` aracıyla üretilir; API key fallback kullanılmaz.
- 18 yaş altı profiller için cinsel/erotik içerik, sexting ve cinsel görsel üretimi kapalıdır; yaşa uygun ilişki ve sağlık konuşmaları cinselleştirmeden yapılabilir. Yetişkin-minör cinsel etkileşimi engellenir.
- Parola, API anahtarı, erişim belirteci veya başka gerçek sır bu depoya yazılmaz.

## Deney raporu metrikleri

- Post, story, beğeni, yorum, takip değişimi, DM, report, görsel, görsel üretim hatası ve aktif persona sayıları; günlük seri ve persona kırılımı.

## Teknik saklama kararları

- SQLite veritabanı `server/data/cygnet.sqlite` altında tutulur; medya ve persona promptları aynı yerel veri alanındadır.
- `CYGNET_DATA_DIR` veritabanı, medya ve prompt dosyalarını birlikte başka bir yerel klasöre yönlendirir; `CYGNET_TICK_MS` test/sandbox simülasyon saatini ayarlar.
- Yerel dışa aktarma `/api/export` ile JSON olarak yapılır. Veritabanı, mesajlar, persona hafızası ve medya yedeği hassas deney verisi sayılır.
- Tarih aralıklı raporlar olay/aktivite kayıtlarını ve rapor anındaki ayar snapshot'ını JSON veya CSV olarak sunar; gerçek yedi günlük sonuç için simülasyonun yedi gün çalışması gerekir.
- Server runtime counter, API sürecinin gerçekten açık olduğu monotonik çalışma süresini biriktirir; normal kapanış ve restartlar toplamı korur, sunucunun kapalı olduğu süre eklenmez.
- Platform usage counter, en az bir Cygnet sekmesi görünür ve odaktayken geçen süreyi toplar; eşzamanlı sekmeler tek kez sayılır. Deney hedefi 604.800.000 ms (7 birikimli platform günü); uygulama bu hedefte otomatik kapanmaz.
- Kullanım süreleri 15 saniyede bir SQLite'a kaydedilir. Ani sunucu kesintisi son checkpoint aralığını kaybettirebilir; ani sekme kapanışı en fazla 30 saniye fazla sayabilir.
- `./cygnet.sh` API ve web arayüzünü tek foreground komutla açar; Ctrl+C her ikisini kapatır. `./cygnet.sh check` izole testleri, `./cygnet.sh benchmark` sentetik performans ölçümünü çalıştırır.
- Seed fotoğrafları `web/public/demo-images/` altında; çalışma sırasında üretilen fotoğraflar `server/data/media/` altında tutulur.

## Gizli bilgiler

Codex CLI kimlik doğrulamasını yerel Codex kurulumundan alır. Oturum/refresh token dosyaları, `.env`, DB kopyaları ve özel DM verileri Git'e eklenmez; depo özel olsa da kimlik bilgileri yalnızca yerel makinede kalır.
