import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

type AccountRestrictionRow = {
  restriction_id: string;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/Istanbul",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(new Date(value));
}

export default async function AccountRestrictedPage() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_active_account_restriction"
  );

  if (error) {
    console.error(
      "Account restriction query failed:",
      {
        message:
          error.message,
        code:
          error.code,
        details:
          error.details,
        hint:
          error.hint,
      }
    );
  }

  const restriction =
    (
      (
        data ?? []
      ) as AccountRestrictionRow[]
    )[0] ?? null;

  if (!restriction && !error) {
    redirect("/timeline");
  }

  async function signOut() {
    "use server";

    const serverSupabase =
      await createClient();

    await serverSupabase.auth.signOut();

    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-2xl">
        <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-100 bg-red-50 px-6 py-8 md:px-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-2xl font-bold text-white">
              !
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-red-700">
              Account Restricted
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-950 md:text-4xl">
              Access to UIN is currently restricted
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-gray-600">
              Your account cannot access
              UIN while this restriction
              is active.
            </p>
          </div>

          <div className="p-6 md:p-8">
            {restriction ? (
              <>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Restriction Reason
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-gray-800">
                    {restriction.reason}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Started
                    </p>

                    <p className="mt-3 font-semibold text-gray-900">
                      {formatDateTime(
                        restriction.starts_at
                      )}{" "}
                      TRT
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ends
                    </p>

                    <p className="mt-3 font-semibold text-gray-900">
                      {restriction.ends_at
                        ? `${formatDateTime(
                            restriction.ends_at
                          )} TRT`
                        : "Indefinite"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-gray-500">
                  An indefinite restriction
                  remains active until it is
                  reviewed and revoked by an
                  authorized UIN administrator.
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-semibold text-amber-900">
                  Restriction details could
                  not be loaded.
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Your account session is
                  active, but the restriction
                  service returned an error.
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    Signed in account
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {user.email ??
                      "Email unavailable"}
                  </p>
                </div>

                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 sm:w-auto"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-xs text-gray-400">
          Restriction ID:{" "}
          {restriction?.restriction_id ??
            "Unavailable"}
        </p>
      </div>
    </main>
  );
}