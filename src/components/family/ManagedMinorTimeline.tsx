import Link from "next/link";

import SignOutButton from "@/components/auth/SignOutButton";
import {
  type FamilyCenterData,
} from "@/components/family/AgeAndFamilyManager";

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

export default function ManagedMinorTimeline({
  familyData,
}: {
  familyData: FamilyCenterData;
}) {
  const self =
    familyData.self;

  const displayName =
    self.full_name ||
    self.username;

  const acceptedGuardians =
    familyData.guardians.filter(
      (guardian) =>
        guardian.status ===
        "accepted"
    );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[32px] border border-blue-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {self.avatar_url ? (
                <img
                  src={
                    self.avatar_url
                  }
                  alt={
                    displayName
                  }
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-2xl font-bold text-blue-700">
                  {getInitial(
                    displayName
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Managed Child Profile
                </p>

                <h1 className="mt-2 text-3xl font-bold text-gray-950">
                  {displayName}
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  @
                  {
                    self.username
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/u/${encodeURIComponent(
                  self.username
                )}`}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
              >
                View Profile
              </Link>

              <Link
                href="/settings/family"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Family & Age Settings
              </Link>

              <SignOutButton />
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-blue-50 p-5">
            <p className="text-sm leading-7 text-blue-950">
              Independent Intent creation,
              friendships, followers and
              public participation requests
              are disabled. Parents or
              guardians manage the profile,
              Intent participation and
              Activity decisions.
            </p>
          </div>
        </header>

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Parents & Guardians
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Adults managing this profile
          </h2>

          {acceptedGuardians.length >
          0 ? (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {acceptedGuardians.map(
                (guardian) => {
                  const guardianName =
                    guardian.full_name ||
                    guardian.username;

                  return (
                    <Link
                      key={
                        guardian.guardian_link_id
                      }
                      href={`/u/${encodeURIComponent(
                        guardian.username
                      )}`}
                      className="group rounded-3xl border border-green-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        {guardian.avatar_url ? (
                          <img
                            src={
                              guardian.avatar_url
                            }
                            alt={
                              guardianName
                            }
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-xl font-bold text-green-700">
                            {getInitial(
                              guardianName
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-bold text-gray-950">
                            {
                              guardianName
                            }
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            @
                            {
                              guardian.username
                            }
                          </p>

                          <p className="mt-2 text-xs font-semibold capitalize text-green-700">
                            {guardian.relationship.replaceAll(
                              "_",
                              " "
                            )}
                          </p>
                        </div>

                        <span className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-green-700">
                          →
                        </span>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="font-bold text-amber-950">
                Guardian setup required
              </h3>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Open Family & Age Settings
                to invite the first Primary
                Guardian.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
