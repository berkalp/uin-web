import type { Metadata } from "next";

import PublicInfoPage, { InfoSection } from "@/components/public/PublicInfoPage";

export const metadata: Metadata = {
  title: "UIN Hesap Silme Talebi",
  description: "UIN hesabını ve hesabınla ilişkili kişisel verileri silme süreci.",
};

export default function AccountDeletionPage() {
  return (
    <PublicInfoPage
      eyebrow="Hesap ve veri kontrolü"
      title="UIN hesabını silme"
      intro="UIN hesabının ve hesabınla ilişkili kişisel verilerin silinmesini uygulamadan veya e-posta yoluyla talep edebilirsin."
    >
      <InfoSection title="Uygulamadan talep gönder">
        <p>UIN uygulamasında Profil → Gizlilik ve Keşfet → Hesabını ve verilerini silme bölümünü açıp “Hesap silme talebi gönder” düğmesine dokun.</p>
      </InfoSection>
      <InfoSection title="Web üzerinden talep gönder">
        <p><a className="font-semibold text-emerald-700 underline underline-offset-4" href="mailto:berkalp@hazircevap.tr?subject=UIN%20hesap%20silme%20talebi">berkalp@hazircevap.tr</a> adresine “UIN hesap silme talebi” konusuyla e-posta gönder. Hesabını bulabilmemiz için UIN kullanıcı adını veya girişte kullandığın e-posta adresini belirt.</p>
      </InfoSection>
      <InfoSection title="Silinen veriler">
        <p>Kimlik doğrulama hesabın, profil bilgilerin ve hesabınla ilişkilendirilen kişisel içeriklerin silinmesi işleme alınır. Başka kişilerin güvenliği, kötüye kullanımın önlenmesi veya yasal yükümlülükler için tutulması zorunlu sınırlı kayıtlar kapsam dışında kalabilir.</p>
      </InfoSection>
      <InfoSection title="Süre ve doğrulama">
        <p>Talebin hesabın sahibi tarafından gönderildiğini doğrulamamız gerekebilir. Doğrulama tamamlandıktan sonra talep makul süre içinde sonuçlandırılır ve kullandığın iletişim kanalından bilgi verilir.</p>
      </InfoSection>
    </PublicInfoPage>
  );
}
