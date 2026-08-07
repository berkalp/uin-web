"use client";

import { supabase } from "@/utils/supabase/client";

export const ACTIVITY_COVER_BUCKET =
  "activity-covers";

export const ACTIVITY_COVER_MAX_BYTES =
  8 * 1024 * 1024;

const EXTENSION_BY_MIME_TYPE =
  new Map<string, string>([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/avif", "avif"],
  ]);

export function validateActivityCoverFile(
  file: File
) {
  if (
    !EXTENSION_BY_MIME_TYPE.has(
      file.type
    )
  ) {
    return "Choose a JPG, PNG, WEBP or AVIF image.";
  }

  if (
    file.size >
    ACTIVITY_COVER_MAX_BYTES
  ) {
    return "Cover images must be 8 MB or smaller.";
  }

  return null;
}

function cleanPathPrefix(
  value: string
) {
  return value
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(
          /[^a-zA-Z0-9_-]/g,
          ""
        )
    )
    .filter(Boolean)
    .join("/");
}

export async function uploadActivityCover({
  file,
  pathPrefix,
}: {
  file: File;
  pathPrefix: string;
}) {
  const validationMessage =
    validateActivityCoverFile(file);

  if (validationMessage) {
    throw new Error(
      validationMessage
    );
  }

  const extension =
    EXTENSION_BY_MIME_TYPE.get(
      file.type
    );

  if (!extension) {
    throw new Error(
      "Unsupported image type."
    );
  }

  const safePrefix =
    cleanPathPrefix(pathPrefix);

  if (!safePrefix) {
    throw new Error(
      "Invalid cover upload path."
    );
  }

  const objectPath = `${safePrefix}/${crypto.randomUUID()}.${extension}`;

  const {
    error: uploadError,
  } = await supabase.storage
    .from(
      ACTIVITY_COVER_BUCKET
    )
    .upload(
      objectPath,
      file,
      {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      }
    );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: publicUrlData,
  } = supabase.storage
    .from(
      ACTIVITY_COVER_BUCKET
    )
    .getPublicUrl(
      objectPath
    );

  return {
    objectPath,
    publicUrl:
      publicUrlData.publicUrl,
  };
}

export function getManagedActivityCoverPath(
  url: string | null | undefined
) {
  if (!url) {
    return null;
  }

  const marker = `/storage/v1/object/public/${ACTIVITY_COVER_BUCKET}/`;
  const markerIndex =
    url.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const encodedPath = url.slice(
    markerIndex +
      marker.length
  );

  if (!encodedPath) {
    return null;
  }

  try {
    return decodeURIComponent(
      encodedPath.split("?")[0]
    );
  } catch {
    return encodedPath.split("?")[0];
  }
}

export async function removeActivityCoverPath(
  objectPath: string
) {
  const {
    error,
  } = await supabase.storage
    .from(
      ACTIVITY_COVER_BUCKET
    )
    .remove([
      objectPath,
    ]);

  if (error) {
    throw error;
  }
}

export async function removeManagedActivityCoverUrl(
  url: string | null | undefined
) {
  const objectPath =
    getManagedActivityCoverPath(
      url
    );

  if (!objectPath) {
    return;
  }

  await removeActivityCoverPath(
    objectPath
  );
}
