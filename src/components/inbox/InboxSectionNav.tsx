import Link from "next/link";

type InboxSection = "messages" | "requests" | "updates";

const SECTIONS: Array<{
  id: InboxSection;
  href: string;
  label: string;
  description: string;
}> = [
  {
    id: "messages",
    href: "/messages",
    label: "Sohbetler",
    description: "Plan ve etkinlik konuşmaları",
  },
  {
    id: "requests",
    href: "/inbox",
    label: "İstekler",
    description: "Yanıt bekleyen kararlar",
  },
  {
    id: "updates",
    href: "/notifications#kart-gelismeleri",
    label: "Gelişmeler",
    description: "Kart ve etkinlik bildirimleri",
  },
];

export default function InboxSectionNav({ active }: { active: InboxSection }) {
  return (
    <nav aria-label="Gelen kutusu bölümleri" className="mt-6 grid gap-3 sm:grid-cols-3">
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
