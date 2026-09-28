import type { Metadata } from "next";

import PublicInfoPage, { InfoSection } from "@/components/public/PublicInfoPage";

export const metadata: Metadata = {
  title: "UIN Kullanım Koşulları",
  description: "UIN hizmetini kullanırken geçerli temel kullanım koşulları.",
};

export default function TermsPage() {
  return (
    <PublicInfoPage
      eyebrow="Son güncelleme · 14 Eylül 2026"
      title="Kullanım Koşulları"
      intro="UIN'i kullanarak aşağıdaki temel kuralları kabul etmiş olursun."
    >
      <InfoSection title="Hesabın">
        <p>Hesabında doğru bilgi kullanmalı, hesabının güvenliğini korumalı ve hesabın üzerinden yapılan işlemlerden sorumlu olmalısın.</p>
      </InfoSection>
      <InfoSection title="Etkinlikler ve diğer kullanıcılar">
        <p>UIN, kullanıcıların niyet ve etkinlik oluşturmasına yardımcı olan bir platformdur. Etkinliklerin düzenlenmesi, uygunluğu, güvenliği, maliyetleri ve katılımcılar arasındaki anlaşmalar ilgili kullanıcıların sorumluluğundadır.</p>
      </InfoSection>
      <InfoSection title="Kabul edilmeyen kullanım">
        <p>Yanıltıcı içerik, taciz, nefret söylemi, dolandırıcılık, izinsiz ticari kullanım, başkalarının haklarını ihlal eden içerik ve hukuka aykırı faaliyetler yasaktır. Güvenlik veya yasal gereklilik halinde içerik ya da hesap erişimi sınırlandırılabilir.</p>
      </InfoSection>
      <InfoSection title="İçerik ve fikri haklar">
        <p>Paylaştığın içerikten sen sorumlusun. UIN'e, içeriği yalnızca hizmeti sunmak ve seçtiğin görünürlük kapsamında göstermek için gerekli sınırlı kullanım iznini verirsin.</p>
      </InfoSection>
      <InfoSection title="Hizmette değişiklik">
        <p>UIN geliştikçe özellikler değişebilir veya geçici olarak kullanılamayabilir. Koşullardaki önemli değişiklikler bu sayfada yayımlanır.</p>
      </InfoSection>
      <InfoSection title="İletişim">
        <p>Bu koşullarla ilgili soruların için <a className="font-semibold text-emerald-700 underline underline-offset-4" href="mailto:berkalp@hazircevap.tr">berkalp@hazircevap.tr</a> adresine ulaşabilirsin.</p>
      </InfoSection>
    </PublicInfoPage>
  );
}
