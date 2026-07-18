import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ManagedMinorInvitationActions from "@/components/family/ManagedMinorInvitationActions";
import AccountContextSwitcher, {
  type ManagedProfileSwitcherRow,
} from "@/components/navigation/AccountContextSwitcher";
import MyProfileMenu from "@/components/navigation/MyProfileMenu";
import StandaloneSignOutButton from "@/components/auth/StandaloneSignOutButton";
import { createClient } from "@/utils/supabase/server";

type ManagedProfilePageProps = {
  params: Promise<{
    childId: string;
  }>;

  searchParams: Promise<{
    view?: string;
  }>;
};

type ManagedView =
  | "pending"
  | "approved"
  | "declined"
  | "past";

type ManagedWorkspace = {
  viewer: {
    user_id: string;
    guardian_role:
      | "primary_guardian"
      | "guardian";
    can_manage_profile: boolean;
    can_manage_activities: boolean;
  };

  child: {
    user_id: string;
    full_name: string | null;
    username: string;
    avatar_url: string | null;
    cover_url: string | null;
  };

  counts: {
    pending: number | string;
    approved: number | string;
    declined: number | string;
    past: number | string;
  };

  guardians: {
    guardian_user_id: string;
    full_name: string | null;
    username: string;
    avatar_url: string | null;
    guardian_role:
      | "primary_guardian"
      | "guardian";
    relationship:
      | "parent"
      | "legal_guardian";
    can_manage_activities: boolean;
  }[];

  invitations: {
    invitation_id: string;
    invitation_status:
      | "pending"
      | "accepted"
      | "declined"
      | "expired"
      | "revoked";
    invitation_message: string | null;
    invitation_expires_at: string;
    invitation_responded_at: string | null;
    invitation_created_at: string;
    responded_by_guardian_user_id: string | null;
    supervising_guardian_user_id: string | null;
    responded_by_guardian_full_name: string | null;
    responded_by_guardian_username: string | null;
    supervising_guardian_full_name: string | null;
    supervising_guardian_username: string | null;
    intent_id: string;
    plan_id: string | null;
    host_user_id: string;
    host_full_name: string | null;
    host_username: string | null;
    host_avatar_url: string | null;
    activity_name: string;
    category_name: string;
    city: string;
    district: string;
    start_date: string;
    end_date: string;
    visibility: string;
    recruitment_status: string;
  }[];
};

type PersonalProfile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function isValidUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isManagedView(
  value: string | undefined
): value is ManagedView {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "declined" ||
    value === "past"
  );
}

function formatDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

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

export default async function ManagedProfilePage({
  params,
  searchParams,
}: ManagedProfilePageProps) {
  const {
    childId,
  } = await params;

  const resolvedSearchParams =
    await searchParams;

  if (
    !childId ||
    !isValidUuid(childId)
  ) {
    notFound();
  }

  const selectedView =
    isManagedView(
      resolvedSearchParams.view
    )
      ? resolvedSearchParams.view
      : "pending";

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    workspaceResponse,
    managedProfilesResponse,
    personalProfileResponse,
    adminResponse,
  ] = await Promise.all([
    supabase.rpc(
      "get_managed_minor_workspace",
      {
        p_child_user_id:
          childId,
      }
    ),

    supabase.rpc(
      "get_my_managed_profile_switcher"
    ),

    supabase
      .from("profiles")
      .select(
        "full_name, username, avatar_url"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle(),

    supabase.rpc(
      "is_admin"
    ),
  ]);

  if (
    workspaceResponse.error ||
    !workspaceResponse.data
  ) {
    console.error(
      "Managed profile workspace query failed:",
      workspaceResponse.error
    );

    redirect("/timeline");
  }

  const workspace =
    workspaceResponse.data as
      ManagedWorkspace;

  const managedProfiles =
    (
      managedProfilesResponse.data ??
      []
    ) as ManagedProfileSwitcherRow[];

  const personalProfile =
    (
      personalProfileResponse.data ??
      {
        full_name: null,
        username: null,
        avatar_url: null,
      }
    ) as PersonalProfile;

  const isAdmin =
    adminResponse.data ===
      true;

  const childName =
    workspace.child.full_name ||
    workspace.child.username;

  const visibleInvitations =
    workspace.invitations.filter(
      (invitation) => {
        if (
          selectedView ===
          "pending"
        ) {
          return (
            invitation.invitation_status ===
            "pending"
          );
        }

        if (
          selectedView ===
          "approved"
        ) {
          return (
            invitation.invitation_status ===
            "accepted"
          );
        }

        if (
          selectedView ===
          "declined"
        ) {
          return (
            invitation.invitation_status ===
            "declined"
          );
        }

        return [
          "expired",
          "revoked",
        ].includes(
          invitation.invitation_status
        );
      }
    );

  const tabs: {
    value: ManagedView;
    label: string;
    count: number;
  }[] = [
    {
      value: "pending",
      label: "Pending",
      count: Number(
        workspace.counts.pending
      ),
    },
    {
      value: "approved",
      label: "Approved",
      count: Number(
        workspace.counts.approved
      ),
    },
    {
      value: "declined",
      label: "Declined",
      count: Number(
        workspace.counts.declined
      ),
    },
    {
      value: "past",
      label: "Past",
      count: Number(
        workspace.counts.past
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Guardian Workspace
          </p>

          <h1 className="mt-3 text-4xl font-bold text-gray-950">
            {childName}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Managed by{" "}
            {personalProfile.full_name ||
              personalProfile.username ||
              "Guardian"}
          </p>

          <div className="mt-7 flex flex-wrap items-start justify-center gap-3">
            <div className="w-full max-w-sm">
              <AccountContextSwitcher
                personal={{
                  fullName:
                    personalProfile.full_name,
                  username:
                    personalProfile.username,
                  avatarUrl:
                    personalProfile.avatar_url,
                }}
                managedProfiles={
                  managedProfiles
                }
                currentContext={{
                  type:
                    "managed_profile",
                  childUserId:
                    childId,
                }}
              />
            </div>

            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-xl bg-gray-950 px-5 py-3 font-semibold text-white"
              >
                Admin Dashboard
              </Link>
            )}

            <MyProfileMenu
              username={
                personalProfile.username
              }
            />

            <StandaloneSignOutButton />
          </div>
        </header>

        <section className="mt-10 overflow-hidden rounded-[32px] border border-blue-200 bg-white shadow-sm">
          <div className="relative h-48 bg-gradient-to-br from-blue-950 via-slate-900 to-emerald-950">
            {workspace.child.cover_url && (
              <img
                src={
                  workspace.child.cover_url
                }
                alt=""
                className="h-full w-full object-cover opacity-65"
              />
            )}
          </div>

          <div className="relative px-6 pb-7">
            <div className="-mt-12 flex flex-col gap-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {workspace.child.avatar_url ? (
                  <img
                    src={
                      workspace.child.avatar_url
                    }
                    alt={childName}
                    className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-blue-50 text-3xl font-bold text-blue-700 shadow-lg">
                    {getInitial(
                      childName
                    )}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-950">
                      {childName}
                    </h2>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Managed Child Profile
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    @
                    {
                      workspace.child.username
                    }
                  </p>

                  <p className="mt-3 text-sm font-semibold capitalize text-green-700">
                    {workspace.viewer.guardian_role.replaceAll(
                      "_",
                      " "
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/u/${encodeURIComponent(
                    workspace.child.username
                  )}`}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  View Child Profile
                </Link>

                {workspace.viewer
                  .can_manage_profile && (
                  <Link
                    href={`/settings/family/${encodeURIComponent(
                      workspace.child.user_id
                    )}/profile`}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Manage Profile
                  </Link>
                )}

                <Link
                  href="/settings/family"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700"
                >
                  Family Settings
                </Link>
              </div>
            </div>
          </div>
        </section>

        <nav className="mt-8 grid grid-cols-2 gap-3 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm md:grid-cols-4">
          {tabs.map(
            (tab) => {
              const active =
                tab.value ===
                selectedView;

              return (
                <Link
                  key={tab.value}
                  href={`/managed/${encodeURIComponent(
                    childId
                  )}?view=${tab.value}`}
                  className={`rounded-2xl p-4 text-center transition ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {tab.label}
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    {tab.count}
                  </p>
                </Link>
              );
            }
          )}
        </nav>

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {selectedView ===
            "pending"
              ? "Action Required"
              : "Invitation History"}
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            {selectedView ===
            "pending"
              ? `Invitations for ${childName}`
              : `${tabs.find(
                  (tab) =>
                    tab.value ===
                    selectedView
                )?.label} invitations`}
          </h2>

          {visibleInvitations.length >
          0 ? (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {visibleInvitations.map(
                (invitation) => {
                  const hostName =
                    invitation.host_full_name ||
                    invitation.host_username ||
                    "UIN host";

                  return (
                    <article
                      key={
                        invitation.invitation_id
                      }
                      className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                            {
                              invitation.category_name
                            }
                          </p>

                          <h3 className="mt-2 text-2xl font-bold text-gray-950">
                            {
                              invitation.activity_name
                            }
                          </h3>

                          <p className="mt-2 text-sm text-gray-500">
                            Hosted by{" "}
                            {hostName}
                          </p>
                        </div>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                          {invitation.invitation_status}
                        </span>
                      </div>

                      <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-600">
                        <p>
                          📅{" "}
                          {formatDate(
                            invitation.start_date
                          )}
                          {" → "}
                          {formatDate(
                            invitation.end_date
                          )}
                        </p>

                        <p>
                          📍{" "}
                          {
                            invitation.district
                          }
                          ,{" "}
                          {
                            invitation.city
                          }
                        </p>

                        <p className="capitalize">
                          👁{" "}
                          {
                            invitation.visibility
                          }
                        </p>
                      </div>

                      {invitation.invitation_message && (
                        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Invitation Message
                          </p>

                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {
                              invitation.invitation_message
                            }
                          </p>
                        </div>
                      )}

                      {invitation.invitation_status ===
                        "pending" &&
                        workspace.viewer
                          .can_manage_activities && (
                          <ManagedMinorInvitationActions
                            invitationId={
                              invitation.invitation_id
                            }
                            currentGuardianUserId={
                              workspace.viewer.user_id
                            }
                            guardians={
                              workspace.guardians
                            }
                          />
                        )}

                      {invitation.invitation_status ===
                        "accepted" && (
                        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
                          <p className="text-sm font-bold text-green-900">
                            Participation approved
                          </p>

                          <p className="mt-2 text-sm leading-6 text-green-800">
                            Supervising guardian:{" "}
                            {invitation.supervising_guardian_full_name ||
                              invitation.supervising_guardian_username ||
                              "Not recorded"}
                          </p>

                          {invitation.plan_id && (
                            <Link
                              href={`/plans/${encodeURIComponent(
                                invitation.plan_id
                              )}/planning`}
                              className="mt-4 inline-flex rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                              Open Planning Room
                            </Link>
                          )}
                        </div>
                      )}

                      {invitation.invitation_status ===
                        "declined" && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                          Declined by{" "}
                          {invitation.responded_by_guardian_full_name ||
                            invitation.responded_by_guardian_username ||
                            "a guardian"}
                          .
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h3 className="font-bold text-gray-950">
                No invitations here
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                This section is currently
                empty.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
