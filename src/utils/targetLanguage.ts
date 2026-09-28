export function targetLanguage(type?: string | null) {
  const value = (type || "").toLocaleLowerCase("tr-TR");
  if (/sport-do|do-sport|spor yap/.test(value)) return { want: "Yapmak isteyenler", done: "Yapanlar", action: "SPOR YAP", icon: "🏃" };
  if (/sport-live|live-sport|live.match|sports-match/.test(value)) return { want: "Yerinde izlemek isteyenler", done: "Yerinde izleyenler", action: "SPORU YERİNDE İZLE", icon: "🏟️" };
  if (/concert|konser/.test(value)) return { want: "Konserine gitmek isteyenler", done: "Konserine gidenler", action: "KONSERE GİT", icon: "🎤" };
  if (/live-performance|canlı izle/.test(value)) return { want: "Canlı izlemek isteyenler", done: "Canlı izleyenler", action: "CANLI SAHNE İZLE", icon: "🎭" };
  if (/read|oku|book|kitap/.test(value)) return { want: "Okumak isteyenler", done: "Okuyanlar", action: "OKU", icon: "📚" };
  if (/watch|izle|movie|film|series|dizi|live.match|sports/.test(value)) return { want: "İzlemek isteyenler", done: "İzleyenler", action: "İZLE", icon: "🎬" };
  if (/listen|dinle|music|müzik|album|artist|sanatçı/.test(value)) return { want: "Dinlemek isteyenler", done: "Dinleyenler", action: "DİNLE", icon: "🎵" };
  if (/explore|keşfet/.test(value)) return { want: "Keşfetmek isteyenler", done: "Keşfedenler", action: "KEŞFET", icon: "🧭" };
  if (/museum|müze|venue|mekan|mekân|landmark|ziyaret/.test(value)) return { want: "Ziyaret etmek isteyenler", done: "Ziyaret edenler", action: "ZİYARET ET", icon: "🏛️" };
  if (/visit|git|place|travel|seyahat/.test(value)) return { want: "Gitmek isteyenler", done: "Gidenler", action: "GİT", icon: "📍" };
  if (/play|oyna|game|oyun/.test(value)) return { want: "Oynamak isteyenler", done: "Oynayanlar", action: "OYNA", icon: "🎮" };
  if (/learn|öğren|course/.test(value)) return { want: "Öğrenmek isteyenler", done: "Öğrenenler", action: "ÖĞREN", icon: "🎓" };
  if (/try|dene/.test(value)) return { want: "Denemek isteyenler", done: "Deneyenler", action: "DENE", icon: "✨" };
  if (/practice|pratik/.test(value)) return { want: "Pratik yapmak isteyenler", done: "Pratik yapanlar", action: "PRATİK YAP", icon: "🌱" };
  if (/create|üret|make|build|tasarla/.test(value)) return { want: "Üretmek isteyenler", done: "Üretenler", action: "ÜRET", icon: "🛠️" };
  return { want: "Yapmak isteyenler", done: "Yapanlar", action: "YAP", icon: "🌱" };
}

export function cardDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
