import { NextResponse } from "next/server";

const FALLBACK_PHOTOS = [
  {
    id: "WbxhqcHG5Jc",
    url: "https://images.unsplash.com/photo-1719178071673-d5587c0b934e?auto=format&fit=crop&w=2400&q=86",
    alt: "İstanbul vapurunda gün batımında yolcular",
    photographer: "Kamil Kalkan",
    photographerUrl: "https://unsplash.com/@kamilklkn?utm_source=uin&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/WbxhqcHG5Jc?utm_source=uin&utm_medium=referral",
  },
  {
    id: "MoPirVSJXh8",
    url: "https://images.unsplash.com/photo-1613221348730-5ba1965c0a8c?auto=format&fit=crop&w=2400&q=86",
    alt: "İstanbul sokaklarında gün batımı",
    photographer: "Andrea Leopardi",
    photographerUrl: "https://unsplash.com/@whatyouhide?utm_source=uin&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/MoPirVSJXh8?utm_source=uin&utm_medium=referral",
  },
];

type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: { raw: string };
  links: { html: string };
  user: {
    name: string;
    links: { html: string };
  };
};

function withReferral(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return url + separator + "utm_source=uin&utm_medium=referral";
}

export async function GET() {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return NextResponse.json(
      { photos: FALLBACK_PHOTOS },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  }

  try {
    const params = new URLSearchParams({
      query: "istanbul activity people",
      orientation: "landscape",
      content_filter: "high",
      order_by: "relevant",
      per_page: "24",
    });

    const response = await fetch("https://api.unsplash.com/search/photos?" + params.toString(), {
      headers: {
        Authorization: "Client-ID " + accessKey,
        "Accept-Version": "v1",
      },
      next: { revalidate: 21600 },
    });

    if (!response.ok) {
      throw new Error("Unsplash search failed with " + response.status);
    }

    const payload = (await response.json()) as { results?: UnsplashPhoto[] };
    const photos = (payload.results ?? []).map((photo) => ({
      id: photo.id,
      url: photo.urls.raw + "&auto=format&fit=crop&w=2400&q=86",
      alt: photo.alt_description || photo.description || "İstanbul'da bir aktivite",
      photographer: photo.user.name,
      photographerUrl: withReferral(photo.user.links.html),
      photoUrl: withReferral(photo.links.html),
    }));

    return NextResponse.json(
      { photos: photos.length > 0 ? photos : FALLBACK_PHOTOS },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("Unsplash landing photo search failed:", error);

    return NextResponse.json(
      { photos: FALLBACK_PHOTOS },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } }
    );
  }
}
