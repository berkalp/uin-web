"use client";

import type {
  SeedJournalAttachment,
  SeedJournalAttachmentKind,
} from "@/utils/seeds";

type SeedLinkedItemsEditorProps = {
  items: SeedJournalAttachment[];
  onChange: (items: SeedJournalAttachment[]) => void;
  maxItems?: number;
  compact?: boolean;
};

function isValidOptionalUrl(value: string) {
  if (!value.trim()) {
    return true;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function emptyItem(index: number): SeedJournalAttachment {
  return {
    url: "",
    kind: "link",
    label: "",
    caption: "",
    sort_order: index,
  };
}

export default function SeedLinkedItemsEditor({
  items,
  onChange,
  maxItems = 12,
  compact = false,
}: SeedLinkedItemsEditorProps) {
  function addItem() {
    if (items.length >= maxItems) {
      return;
    }

    onChange([...items, emptyItem(items.length)]);
  }

  function updateItem(
    index: number,
    patch: Partial<SeedJournalAttachment>
  ) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  }

  function removeItem(index: number) {
    onChange(
      items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({
          ...item,
          sort_order: itemIndex,
        }))
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Linked items</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Add image, video or webpage URLs. No file upload.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={items.length >= maxItems}
          className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add linked item
        </button>
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <article
              key={index}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Item {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>

              <div
                className={`mt-3 grid gap-3 ${
                  compact ? "md:grid-cols-2" : "sm:grid-cols-2"
                }`}
              >
                <label>
                  <span className="text-xs font-semibold text-gray-600">
                    Type
                  </span>
                  <select
                    value={item.kind}
                    onChange={(event) =>
                      updateItem(index, {
                        kind: event.target
                          .value as SeedJournalAttachmentKind,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="link">Link</option>
                    <option value="image">Image URL</option>
                    <option value="video">Video URL</option>
                  </select>
                </label>

                <label>
                  <span className="text-xs font-semibold text-gray-600">
                    Label
                  </span>
                  <input
                    value={item.label ?? ""}
                    onChange={(event) =>
                      updateItem(index, { label: event.target.value })
                    }
                    maxLength={100}
                    placeholder="Optional label"
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">
                    URL
                  </span>
                  <input
                    type="url"
                    value={item.url}
                    onChange={(event) =>
                      updateItem(index, { url: event.target.value })
                    }
                    placeholder="https://..."
                    className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 outline-none focus:border-blue-500 ${
                      isValidOptionalUrl(item.url)
                        ? "border-gray-200"
                        : "border-red-300 bg-red-50"
                    }`}
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">
                    Caption
                  </span>
                  <input
                    value={item.caption ?? ""}
                    onChange={(event) =>
                      updateItem(index, { caption: event.target.value })
                    }
                    maxLength={500}
                    placeholder="What this adds to the Seed"
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
