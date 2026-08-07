"use client";

import {
  INTENT_LINK_TYPE_OPTIONS,
  type IntentLinkInput,
  type IntentLinkType,
} from "@/utils/intentLinks";

const MAX_LINKS = 5;

function createEmptyLink(): IntentLinkInput {
  return {
    id:
      `new-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
    linkType:
      "official_event",
    label:
      "",
    url:
      "",
  };
}

export default function IntentLinksEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: IntentLinkInput[];
  onChange: (
    links: IntentLinkInput[]
  ) => void;
  disabled?: boolean;
}) {
  function updateLink(
    index: number,
    patch: Partial<IntentLinkInput>
  ) {
    onChange(
      value.map(
        (
          link,
          linkIndex
        ) =>
          linkIndex ===
          index
            ? {
                ...link,
                ...patch,
              }
            : link
      )
    );
  }

  function removeLink(
    index: number
  ) {
    onChange(
      value.filter(
        (
          _link,
          linkIndex
        ) =>
          linkIndex !==
          index
      )
    );
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Related links
          </p>

          <h3 className="mt-1 font-bold text-gray-950">
            Event, ticket and organizer information
          </h3>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">
            Add official pages that help
            people understand or join this
            Intent. Only secure HTTPS links
            are accepted.
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
          {value.length} /{" "}
          {MAX_LINKS}
        </span>
      </div>

      {value.length >
      0 ? (
        <div className="mt-5 space-y-3">
          {value.map(
            (
              link,
              index
            ) => (
              <div
                key={
                  link.id ??
                  index
                }
                className="rounded-2xl border border-blue-100 bg-white p-4"
              >
                <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      Link type
                    </span>

                    <select
                      value={
                        link.linkType
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event
                      ) =>
                        updateLink(
                          index,
                          {
                            linkType:
                              event
                                .target
                                .value as IntentLinkType,
                          }
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
                    >
                      {INTENT_LINK_TYPE_OPTIONS.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              option.value
                            }
                            value={
                              option.value
                            }
                          >
                            {
                              option.label
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-gray-600">
                      HTTPS URL
                    </span>

                    <input
                      type="url"
                      inputMode="url"
                      value={
                        link.url
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event
                      ) =>
                        updateLink(
                          index,
                          {
                            url:
                              event
                                .target
                                .value,
                          }
                        )
                      }
                      placeholder="https://..."
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={
                      disabled
                    }
                    onClick={() =>
                      removeLink(
                        index
                      )
                    }
                    className="self-end rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-gray-600">
                    Custom label{" "}
                    {link.linkType ===
                    "other"
                      ? "(required)"
                      : "(optional)"}
                  </span>

                  <input
                    value={
                      link.label
                    }
                    disabled={
                      disabled
                    }
                    maxLength={
                      80
                    }
                    onChange={(
                      event
                    ) =>
                      updateLink(
                        index,
                        {
                          label:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                    placeholder={
                      link.linkType ===
                      "ticket"
                        ? "Buy tickets"
                        : link.linkType ===
                            "official_event"
                          ? "Official concert page"
                          : "Optional button label"
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
                  />
                </label>
              </div>
            )
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-blue-200 bg-white px-4 py-5 text-sm text-gray-500">
          No related links added.
        </p>
      )}

      {value.length <
        MAX_LINKS && (
        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            onChange([
              ...value,
              createEmptyLink(),
            ])
          }
          className="mt-4 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
        >
          + Add related link
        </button>
      )}
    </section>
  );
}
