import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

function copyResponseCookies(
  sourceResponse: NextResponse,
  targetResponse: NextResponse
) {
  sourceResponse.cookies
    .getAll()
    .forEach((cookie) => {
      const {
        name,
        value,
        ...options
      } = cookie;

      targetResponse.cookies.set(
        name,
        value,
        options
      );
    });

  return targetResponse;
}

export async function proxy(
  request: NextRequest
) {
  let response =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            response =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  const pathname =
    request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith(
      "/auth/"
    );

  const isRestrictedPage =
    pathname ===
    "/account-restricted";

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error(
      "Proxy authentication check failed:",
      {
        message:
          claimsError.message,
        code:
          claimsError.code,
      }
    );

    return response;
  }

  const userId =
    typeof claimsData?.claims
      ?.sub === "string"
      ? claimsData.claims.sub
      : null;

  if (
    !userId ||
    isAuthRoute ||
    isRestrictedPage
  ) {
    return response;
  }

  const {
    data:
      hasAccountRestriction,
    error:
      restrictionError,
  } = await supabase.rpc(
    "has_active_account_restriction"
  );

  if (restrictionError) {
    console.error(
      "Proxy account restriction check failed:",
      {
        message:
          restrictionError.message,
        code:
          restrictionError.code,
        details:
          restrictionError.details,
        hint:
          restrictionError.hint,
      }
    );

    return response;
  }

  if (
    hasAccountRestriction ===
    true
  ) {
    const redirectUrl =
      request.nextUrl.clone();

    redirectUrl.pathname =
      "/account-restricted";

    redirectUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(
        redirectUrl
      );

    return copyResponseCookies(
      response,
      redirectResponse
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};