import type { Metadata } from "next";

import PublicInfoPage, { InfoSection } from "@/components/public/PublicInfoPage";

export const metadata: Metadata = {
  title: "UIN Gizlilik Politikası",
  description: "UIN'in kişisel verileri nasıl kullandığını açıklayan gizlilik politikası.",
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow="Son güncelleme · 14 Eylül 2026"
      title="Gizlilik Politikası"
      intro="Bu politika, UIN'i kullandığında hangi bilgilerin işlendiğini ve bu bilgilerle ilgili seçimlerini açıklar."
    >
      <InfoSection title="Topladığımız bilgiler">
        <p>Google ile giriş yaptığında Google hesabından ad, e-posta adresi, profil fotoğrafı ve benzersiz hesap kimliği alınabilir. Ayrıca UIN içinde paylaştığın niyetler, etkinlikler, tercihler, seçtiğin konumlar, mesajlar ve profil bilgileri işlenebilir.</p>
      </InfoSection>
      <InfoSection title="Bilgileri neden kullanıyoruz?">
        <p>Bilgileri hesabını oluşturmak, güvenli giriş sağlamak, seçtiğin konulara göre içerik ve kişiler göstermek, etkinlik planlamasını yürütmek, bildirimleri iletmek, kötüye kullanımı önlemek ve hizmeti geliştirmek için kullanırız.</p>
      </InfoSection>
      <InfoSection title="Google verileri">
        <p>Google hesabından alınan bilgiler yalnızca kimlik doğrulama ve UIN profilini oluşturma amaçlarıyla kullanılır. Google şifrene erişmeyiz. Google kullanıcı verilerini reklam amacıyla satmayız.</p>
      </InfoSection>
      <InfoSection title="Hizmet sağlayıcılar">
        <p>Kimlik doğrulama ve veri saklama için Supabase, uygulamayı yayınlamak için Vercel ve giriş ekranındaki fotoğraflar için Unsplash kullanılabilir. Bu sağlayıcılar yalnızca hizmetin çalışması için gerekli ölçüde veri işler.</p>
      </InfoSection>
      <InfoSection title="Paylaşım ve görünürlük">
        <p>Profilinde, niyetlerinde ve etkinliklerinde seçtiğin görünürlük ayarları hangi kullanıcıların bilgilerini görebileceğini belirler. Yasal zorunluluk veya güvenlik gereği dışında kişisel verilerini üçüncü taraflara satmayız.</p>
      </InfoSection>
      <InfoSection title="Saklama, düzeltme ve silme">
        <p>Bilgilerini hesabın ve hizmet için gerekli olduğu sürece saklarız. Bilgilerine erişmek, düzeltmek veya hesabınla birlikte silinmesini istemek için <a className="font-semibold text-emerald-700 underline underline-offset-4" href="mailto:berkalp@hazircevap.tr">berkalp@hazircevap.tr</a> adresine başvurabilirsin.</p>
      </InfoSection>
      <InfoSection title="Güvenlik ve değişiklikler">
        <p>Verileri korumak için makul teknik ve idari önlemler uygularız. Bu politika değişirse güncelleme tarihini bu sayfada yenileriz.</p>
      </InfoSection>
    </PublicInfoPage>
  );
}
