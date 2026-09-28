import { targetLanguage } from "@/utils/targetLanguage";

type TopicLike = {
  title?: string | null;
  subtitle?: string | null;
  creator_name?: string | null;
  seed_type_slug?: string | null;
  seed_type_icon?: string | null;
  item_kind?: string | null;
  sport_name?: string | null;
  subject_type?: string | null;
};

const GENERIC_LIVE_SPORT_TITLES = new Set([
  "sporu yerinde canlı izlemek",
  "sporu yerinde izlemek",
  "watch sports live at the venue",
]);

function normalizedTitle(value?: string | null) {
  return (value || "").trim().toLocaleLowerCase("tr-TR");
}

export function topicPresentation(item: TopicLike) {
  const words = targetLanguage(item.seed_type_slug);
  const kind = (item.item_kind || "").toLocaleLowerCase("tr-TR");
  const subtype = item.subject_type?.trim() || item.sport_name?.trim()
    || (words.action === "OKU" ? "KİTAP"
      : words.action === "İZLE" ? (kind === "movie" ? "FİLM / DİZİ" : "VİDEO")
      : words.action === "DİNLE" ? "MÜZİK"
      : words.action === "CANLI SAHNE İZLE" ? "SAHNE"
      : words.action === "SPORU YERİNDE İZLE" ? "SPOR"
      : words.action === "GİT" ? "ŞEHİR / BÖLGE"
      : words.action === "ZİYARET ET" ? "MEKÂN"
      : words.action === "OYNA" ? "OYUN"
      : words.action === "ÖĞREN" ? "BECERİ"
      : words.action === "DENE" ? "DENEYİM"
      : words.action === "KONSERE GİT" ? "KONSER"
      : "AKTİVİTE");
  return { ...words, icon: item.seed_type_icon?.trim() || words.icon, subtype: subtype.toLocaleUpperCase("tr-TR"), badge: `${words.action} · ${subtype.toLocaleUpperCase("tr-TR")}` };
}

export function topicDisplayIdentity(item: TopicLike) {
  const presentation = topicPresentation(item);
  const rawTitle = item.title?.trim() || "Konu";
  const rawSubtitle = item.subtitle?.trim() || item.creator_name?.trim() || "";
  const isGenericLiveSport = presentation.action === "SPORU YERİNDE İZLE"
    && GENERIC_LIVE_SPORT_TITLES.has(normalizedTitle(rawTitle));

  if (isGenericLiveSport && rawSubtitle) {
    return {
      title: rawSubtitle,
      subtitle: presentation.subtype === "SPOR" ? "Spor takımı" : `${presentation.subtype.toLocaleLowerCase("tr-TR")} takımı`,
    };
  }

  return { title: rawTitle, subtitle: rawSubtitle };
}

export function topicCreatorLabel(item: TopicLike) {
  const action = topicPresentation(item).action;
  if (action === "SPORU YERİNDE İZLE") return "Takım";
  if (action === "OKU") return "Yazar";
  if (action === "İZLE") return "Yönetmen / yapımcı";
  if (action === "DİNLE" || action === "KONSERE GİT") return "Sanatçı";
  if (action === "ZİYARET ET" || action === "GİT") return "Yer";
  return "Üreten / hazırlayan";
}

export function newTopicLabel(action: string) {
  const labels: Record<string, string> = {
    "OKU": "Yeni kitap ekle", "İZLE": "Yeni film veya dizi ekle", "DİNLE": "Yeni müzik ekle",
    "CANLI SAHNE İZLE": "Yeni sahne türü ekle", "SPORU YERİNDE İZLE": "Yeni takım veya spor ekle", "SPOR YAP": "Yeni spor ekle",
    "GİT": "Yeni şehir veya bölge ekle", "ZİYARET ET": "Yeni mekân ekle", "OYNA": "Yeni oyun ekle",
    "ÖĞREN": "Yeni öğrenme konusu ekle", "DENE": "Yeni deneyim konusu ekle", "KONSERE GİT": "Yeni konser konusu ekle",
  };
  return labels[action] || "Yeni aktivite ekle";
}
