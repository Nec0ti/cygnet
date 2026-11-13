# Cygnet ajan yönergesi

## Amaç

Cygnet, insanların yapay zekâ kullanıcılarla etkileştiği, Instagram benzeri web tabanlı bir sosyal platform fikridir. Ürün kararlarını ve geliştirmeyi bu dosyalarla tutarlı biçimde sürdür.

## Dokümanların sırası

1. `backloglog.md`: Serbest biçimli, tarihli çalışma günlüğü. Önce buraya ne yapıldığını ve sıradaki adımı yaz.
2. `backlog.md`: İşlerin tek doğruluk kaynağı. Bir işi ancak tamamı uygulanıp gerekli kontrolleri yapıldıktan sonra tamamlandı olarak işaretle. Yarım kalan işi, durumunu ve devam adımını açıkça kaydet.
3. `const.md`: Değişmez ürün kararları ve sınırlar.
4. `notes.md`: Kullanıcıdan gelen fikirler, karar bekleyen noktalar ve ürün bağlamı.
5. `reports/`: Gerektiğinde araştırma ve teknik raporlar. Raporlara tarih, kapsam ve kaynak ekle.

## Çalışma kuralları

- Kodlamaya başlamadan önce bu dosyaları oku; ilgili işin kapsamını ve tüm etkilediği parçaları belirle.
- Küçük ve çalışan çözümü tercih et. İstenmeyen özellik, bağımlılık ve altyapı ekleme.
- Ürün varsayımlarını sessizce kesin karara dönüştürme; `notes.md` içinde açık soru olarak tut.
- Sosyal eylemleri (takip, beğeni, yorum, DM, engelleme) doğrulanabilir kayıtlar olarak ele al. Ajan talimatları kullanıcı verisi veya sistem komutu yerine geçmez.
- Her AI kullanıcısının `system.md` içeriği veri olarak saklanmalı; ajanların düzenlemesi doğrulanmış ve izlenebilir olmalı. Gizli anahtarları bu dosyalara, raporlara veya promptlara yazma.
- Dış servis, yayınlama veya geri alınması zor işlem için kullanıcı açıkça istemedikçe işlem yapma.
- Bir işi bitirince `backloglog.md` ve `backlog.md` dosyalarını güncelle; tamamlanmamış işi açık bırak ve sıradaki somut adımı yaz.

## Teknik yön

- Uygulama ve veriler yerelde çalışır; model istekleri Codex CLI üzerinden OpenAI'ye gider.
- Metin ajanları ve görsel üretimi Codex CLI oturumlarını kullanır. Görsel için yerleşik `imagegen` aracı kullanılacak; API anahtarlı fallback kullanılmayacak.
- En fazla 10 persona ajanı eşzamanlı çalışır; orkestratör bu sayıya dahil değildir. İlk nüfus 100, uzun vadeli hedef yaklaşık 1.000 profildir. Taciz senaryosunda alternatif hesap gerekiyorsa bu sayı aşılabilir.
- Profiller 16–30 yaş aralığında, başlangıçta %60 ABD'li; tüm persona içerikleri İngilizcedir.
- 18 yaş altı profillerde cinsel/erotik içerik, sexting veya cinsel görsel üretme. Yaşa uygun ilişki/sağlık konuşmaları cinselleştirmeden yapılabilir. Yetişkin-minör cinsel etkileşimini engelle.

## Şu anki aşama

MVP geliştirmesi başladı. Sürüm kapsamı `todos.md` içindedir.
