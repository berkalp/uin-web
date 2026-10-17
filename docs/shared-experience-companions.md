# Ortak deneyimler ve arkadaş değerlendirmesi

Deneyim formlarında arkadaş seçimi isteğe bağlıdır. Seçim yapıldığında aktivite
konusu zorunludur; arkadaş puanı sonradan da verilebilir. Arkadaş onaylamadan
kendi hesabında tamamlanmış deneyim oluşmaz. Onay, kişisel puan, not ve fotoğraf
kopyalamadan aynı konuya bağlı ayrı bir deneyim oluşturur.

## Puan hesabı

- Yalnızca iki tarafın da onayladığı ve kişisel kayıtları hâlâ tamamlanmış olan
  deneyimler sayılır. Engellenmiş hesaplar ve yönetilen çocuk hesapları dışlanır.
- Gönderilen arkadaş puanı değiştirilemez. İki taraf puan verdikten sonra veya
  son onaydan yedi gün sonra ortalamaya katılır. Alınan tekil puan açıklanmaz.
- Her değerlendiren kişinin aynı aktivitedeki puanları önce kendi içinde
  ortalanır. Ardından kişi ortalamalarının eşit ağırlıklı ortalaması alınır.
- On farklı değerlendiren kişide “Deneyimli katılımcı”; ortalama ayrıca en az
  8 olduğunda “Sevilen deneyim arkadaşı” rozeti gösterilir.
- Konser, mekân veya kitap için kişisel değerlendirme bu hesaptan ayrıdır.
- Katılım onayını geri çekmek kişisel geçmişi silmez; ortak puana katkıyı kaldırır.

## Saklama ve tekrar gönderme

`shared_experience_action` yetki kontrolü yapan özel şema fonksiyonuna yönlendirir.
Tabloların doğrudan istemci erişimi kapalıdır; RLS varsayılan olarak tüm satırları
reddeder. Bu nedenle [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
bilgi düzeyindeki denetim sonucu bu dört özel tablo için beklenir.

Bir kaynak deneyimin yalnızca bir ortak deneyim grubu vardır. Tekrar onay,
davet ve puan gönderme yeni kayıt oluşturmaz. “Aynı konuda başka bir deneyim” ve
geçmiş deneyim formu istek kimliğiyle korunur; farklı gerçek deneyimler ayrı
kayıtlardır. Mevcut kişisel geçmiş üzerinde toplu dönüşüm yapılmaz.

## Doğrulama

`node --test tests/shared-experiences.test.mjs` istemci doğrulamasını ve RPC
hatalarının başarı gibi gösterilmemesini kontrol eder. `tests/shared-experiences.sql`
yalnızca BEGIN/ROLLBACK içinde çalıştırılmalıdır: onay/ret, yetkisiz erişim,
tekrar gönderme, yedi gün kuralı, kişi başına eşit ağırlık, rozet eşiği ve
kişisel geçmişin korunmasını sınar. Test davetleri kalıcılaştırılmamalıdır.
