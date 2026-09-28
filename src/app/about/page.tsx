import type { Metadata } from "next";

import PublicInfoPage, { InfoSection } from "@/components/public/PublicInfoPage";

export const metadata: Metadata = {
  title: "UIN Hakkında",
  description: "UIN'in amacı ve Google ile giriş kullanımına ilişkin temel bilgiler.",
};

export default function AboutPage() {
  return (
    <PublicInfoPage
      eyebrow="UIN Hakkında"
      title="Yapmak istediğin şeyle başla."
      intro="UIN, insanların yapmak, öğrenmek, okumak, izlemek veya gitmek istedikleri şeyler üzerinden niyetlerini paylaşmasına ve uygun insanlarla gerçek etkinlikler planlamasına yardımcı olur."
    >
      <InfoSection title="Nasıl çalışır?">
        <p>Bir konu seçer, ne yapmak istediğini ve uygun olduğun zamanı belirtirsin. Aynı konuya ilgi duyan kişileri ve katılabileceğin açık etkinlikleri görebilirsin.</p>
      </InfoSection>
      <InfoSection title="Google ile giriş">
        <p>Google ile giriş yalnızca hesabını güvenli biçimde oluşturmak ve seni tekrar tanımak için kullanılır. UIN, Google şifreni görmez veya saklamaz.</p>
      </InfoSection>
      <InfoSection title="İletişim">
        <p>Soruların için <a className="font-semibold text-emerald-700 underline underline-offset-4" href="mailto:berkalp@hazircevap.tr">berkalp@hazircevap.tr</a> adresine yazabilirsin.</p>
      </InfoSection>
    </PublicInfoPage>
  );
}
