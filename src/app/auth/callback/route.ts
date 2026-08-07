import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

function getSafeNextPath(
  value: string | null
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/timeline";
  }

  return value;
}

export async function GET(
  request: Request
) {
  const requestUrl =
    new URL(request.url);

  const code =
    requestUrl.searchParams.get(
      "code"
    );

  const nextPath =
    getSafeNextPath(
      requestUrl.searchParams.get(
        "next"
      )
    );

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/?auth_error=missing_code",
        requestUrl.origin
      )
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase.auth
      .exchangeCodeForSession(
        code
      );

  if (error) {
    console.error(
      "OAuth callback exchange failed:",
      {
        message:
          error.message,
        status:
          error.status,
        code:
          error.code,
      }
    );

    return NextResponse.redirect(
      new URL(
        "/?auth_error=callback_failed",
        requestUrl.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      nextPath,
      requestUrl.origin
    )
  );
}
