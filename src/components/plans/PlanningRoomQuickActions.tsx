"use client";

type QuickAction = {
  targetId: string;
  icon: string;
  label: string;
};

export default function PlanningRoomQuickActions({
  actions,
}: {
  actions: QuickAction[];
}) {
  function openAndScroll(targetId: string) {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const details =
      target instanceof HTMLDetailsElement
        ? target
        : target.closest("details");

    if (details instanceof HTMLDetailsElement) {
      details.open = true;
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <nav
      className="mt-5 flex flex-wrap gap-2 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm"
      aria-label="Planning Room quick actions"
    >
      {actions.map((action) => (
        <button
          key={action.targetId}
          type="button"
          onClick={() => openAndScroll(action.targetId)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-800"
        >
          <span aria-hidden="true">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </nav>
  );
}
