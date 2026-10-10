import Link from "next/link";

export type InboxSection =
  | "all"
  | "chats"
  | "requests"
  | "activities"
  | "cards"
  | "staff";

const SECTIONS: Array<{
  id: InboxSection;
  href: string;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    href: "/notifications",
    label: "Tümü",
    description: "Tüm bildirim akışı",
  },
  {
    id: "chats",
    href: "/collaboration-suggestions#sohbetler",
    label: "Sohbetler",
    description: "Tanışma konuşmaları",
  },
  {
    id: "requests",
    href: "/inbox#istekler",
    label: "İstekler",
    description: "Yanıt bekleyen kararlar",
  },
  {
    id: "activities",
    href: "/messages?section=activities#etkinlikler",
    label: "Etkinlikler",
    description: "Planlama ve aktivite odaları",
  },
  {
    id: "cards",
    href: "/notifications?section=cards#kart-gelismeleri",
    label: "Takip Ettiğim Kartlardan",
    description: "Yeni niyet, deneyim ve etkinlik",
  },
  {
    id: "staff",
    href: "/messages?section=staff#uin-ekibinden",
    label: "UIN Ekibinden",
    description: "Sana özel destek mesajları",
  },
];

export default function InboxSectionNav({ active }: { active: InboxSection }) {
  return (
    <nav aria-label="Gelen kutusu bölümleri" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {SECTIONS.map((section) => {
        const selected = section.id === active;

        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={selected ? "page" : undefined}
            className={`rounded-2xl border px-4 py-3 transition ${
              selected
                ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
                : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/40"
            }`}
          >
            <span className="block text-sm font-black">{section.label}</span>
            <span className={`mt-1 block text-xs ${selected ? "text-emerald-700" : "text-gray-500"}`}>
              {section.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
