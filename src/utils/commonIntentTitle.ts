const GENERIC_TITLES: Record<string, string> = {
  "nature trip": "Doğa Gezisi",
  "cultural trip": "Kültür Gezisi",
  "meet new people": "Yeni İnsanlarla Tanışmak",
  "city walk": "Şehir Yürüyüşü",
  "brainstorming session": "Beyin Fırtınası",
  "beach trip": "Sahil Gezisi",
  walking: "Yürüyüş",
  "family picnic": "Aile Pikniği",
  "bicycle tour": "Bisiklet Turu",
  "video gaming meetup": "Video Oyunu Buluşması",
  "watch a sports broadcast together": "Birlikte Spor Yayını İzlemek",
  "sing karaoke": "Karaoke Söylemek",
  camping: "Kamp Yapmak",
  "coworking session": "Birlikte Çalışma",
  "have dinner together": "Birlikte Akşam Yemeği",
  "dinner meetup": "Akşam Yemeği Buluşması",
  cycling: "Bisiklete Binmek",
  concert: "Konser",
  "host a house gathering": "Ev Buluşması Düzenlemek",
  "forest walk": "Orman Yürüyüşü",
  "watch sports live at the venue": "Sporu Yerinde Canlı İzlemek",
  rowing: "Kürek",
  "road trip": "Araba Yolculuğu",
  "day trip": "Günübirlik Gezi",
  festival: "Festival",
  "photography walk": "Fotoğraf Yürüyüşü",
};

export function commonIntentTitle(title: string | null | undefined): string {
  const source = title?.trim() || "Konu";
  return GENERIC_TITLES[source.toLocaleLowerCase("en-US")] || source;
}
