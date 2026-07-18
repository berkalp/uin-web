import Link from "next/link";

export type PublicFamilyChild = {
  guardian_link_id: string;
  child_user_id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  relationship:
    | "parent"
    | "legal_guardian";
  guardian_role:
    | "primary_guardian"
    | "guardian";
};

export type PublicFamilyRelationship = {
  relationship_id: string;
  relationship_type:
    | "spouse"
    | "partner";
  other_user_id: string;
  other_full_name: string | null;
  other_username: string;
  other_avatar_url: string | null;
};

export type PublicFamilyData = {
  children: PublicFamilyChild[];
  relationships: PublicFamilyRelationship[];
};

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function FamilyPersonRow({
  href,
  name,
  username,
  avatarUrl,
  label,
  badge,
}: {
  href: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  label: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
          {getInitial(name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-gray-950">
          {name}
        </p>

        <p className="mt-0.5 truncate text-xs text-gray-500">
          @{username}
        </p>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {label}
          </span>

          {badge && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {badge}
            </span>
          )}
        </div>
      </div>

      <span className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-amber-700">
        →
      </span>
    </Link>
  );
}

export default function AdultPublicFamily({
  data,
}: {
  data: PublicFamilyData;
}) {
  const hasChildren =
    data.children.length >
      0;

  const hasRelationships =
    data.relationships.length >
      0;

  if (
    !hasChildren &&
    !hasRelationships
  ) {
    return null;
  }

  return (
    <aside className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Family
      </p>

      <div className="mt-4 space-y-5">
        {hasChildren && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Children
            </p>

            <div className="mt-2 space-y-2">
              {data.children.map(
                (child) => {
                  const childName =
                    child.full_name ||
                    child.username;

                  return (
                    <FamilyPersonRow
                      key={
                        child.guardian_link_id
                      }
                      href={`/u/${encodeURIComponent(
                        child.username
                      )}`}
                      name={
                        childName
                      }
                      username={
                        child.username
                      }
                      avatarUrl={
                        child.avatar_url
                      }
                      label={
                        child.relationship ===
                        "parent"
                          ? "Child"
                          : "Managed Child"
                      }
                      badge="Managed Profile"
                    />
                  );
                }
              )}
            </div>
          </div>
        )}

        {hasRelationships && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Relationships
            </p>

            <div className="mt-2 space-y-2">
              {data.relationships.map(
                (relationship) => {
                  const otherName =
                    relationship.other_full_name ||
                    relationship.other_username;

                  return (
                    <FamilyPersonRow
                      key={
                        relationship.relationship_id
                      }
                      href={`/u/${encodeURIComponent(
                        relationship.other_username
                      )}`}
                      name={
                        otherName
                      }
                      username={
                        relationship.other_username
                      }
                      avatarUrl={
                        relationship.other_avatar_url
                      }
                      label={
                        relationship.relationship_type ===
                        "spouse"
                          ? "Spouse"
                          : "Partner"
                      }
                    />
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
