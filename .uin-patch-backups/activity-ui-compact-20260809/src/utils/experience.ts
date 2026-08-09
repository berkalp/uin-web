export type ExperienceVisibility =
  | "participants"
  | "friends"
  | "public";

export type ExperienceMediaType =
  | "photo"
  | "video"
  | "external_photo"
  | "external_album"
  | "external_video"
  | "external_post";

export type ExperienceMediaProvider =
  | "direct"
  | "google_photos"
  | "instagram"
  | "youtube"
  | "vimeo"
  | "other";

export type ExperienceMediaPublicStatus =
  | "private"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type ExperienceTagStatus =
  | "pending"
  | "approved"
  | "declined"
  | "removed";

export type ExperiencePerson = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string;
};

export type ExperienceMediaTag = {
  id: string;
  taggedUserId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: ExperienceTagStatus;
  isCurrentViewer: boolean;
};

export type ExperienceMediaComment = {
  id: string;
  body: string;
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type ExperienceMediaItem = {
  id: string;
  mediaType: ExperienceMediaType;
  provider: ExperienceMediaProvider | null;
  storagePath: string | null;
  signedUrl: string | null;
  mimeType: string | null;
  originalFilename: string | null;
  externalUrl: string | null;
  label: string | null;
  caption: string | null;
  visibility: ExperienceVisibility;
  publicStatus: ExperienceMediaPublicStatus;
  publicRequestedAt: string | null;
  publicRejectionLocked: boolean;
  uploaderUserId: string;
  uploaderName: string | null;
  uploaderUsername: string | null;
  uploaderAvatarUrl: string | null;
  createdAt: string;
  isCover: boolean;
  canDelete: boolean;
  canRequestPublic: boolean;
  canSetCover: boolean;
  canComment: boolean;
  appearanceReported: boolean;
  tags: ExperienceMediaTag[];
  comments: ExperienceMediaComment[];
};

export type SharedExperience = {
  id: string;
  planId: string;
  title: string;
  story: string | null;
  visibility: ExperienceVisibility;
  coverMediaId: string | null;
  completedAt: string | null;
  canManage: boolean;
  canContribute: boolean;
  viewerIsParticipant: boolean;
};

export type ExperienceBundle = {
  sharedTitle: string | null;
  canonicalActivityName: string | null;
  experience: SharedExperience | null;
  media: ExperienceMediaItem[];
  tagCandidates: ExperiencePerson[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parsePerson(value: unknown): ExperiencePerson {
  const row = asRecord(value);

  return {
    userId: asString(row.user_id) ?? "",
    fullName: asString(row.full_name),
    username: asString(row.username),
    avatarUrl: asString(row.avatar_url),
    role: asString(row.role) ?? "participant",
  };
}

function parseTag(value: unknown): ExperienceMediaTag {
  const row = asRecord(value);

  return {
    id: asString(row.id) ?? "",
    taggedUserId: asString(row.tagged_user_id) ?? "",
    fullName: asString(row.full_name),
    username: asString(row.username),
    avatarUrl: asString(row.avatar_url),
    status: (asString(row.status) ?? "pending") as ExperienceTagStatus,
    isCurrentViewer: asBoolean(row.is_current_viewer),
  };
}

function parseComment(value: unknown): ExperienceMediaComment {
  const row = asRecord(value);

  return {
    id: asString(row.id) ?? "",
    body: asString(row.body) ?? "",
    userId: asString(row.user_id) ?? "",
    fullName: asString(row.full_name),
    username: asString(row.username),
    avatarUrl: asString(row.avatar_url),
    createdAt: asString(row.created_at) ?? "",
    canDelete: asBoolean(row.can_delete),
  };
}

function parseMedia(value: unknown): ExperienceMediaItem {
  const row = asRecord(value);
  const rawTags = Array.isArray(row.tags) ? row.tags : [];
  const rawComments = Array.isArray(row.comments) ? row.comments : [];

  return {
    id: asString(row.id) ?? "",
    mediaType: (asString(row.media_type) ?? "photo") as ExperienceMediaType,
    provider: asString(row.provider) as ExperienceMediaProvider | null,
    storagePath: asString(row.storage_path),
    signedUrl: null,
    mimeType: asString(row.mime_type),
    originalFilename: asString(row.original_filename),
    externalUrl: asString(row.external_url),
    label: asString(row.label),
    caption: asString(row.caption),
    visibility: (asString(row.visibility) ?? "participants") as ExperienceVisibility,
    publicStatus: (asString(row.public_status) ?? "private") as ExperienceMediaPublicStatus,
    publicRequestedAt: asString(row.public_requested_at),
    publicRejectionLocked: asBoolean(row.public_rejection_locked),
    uploaderUserId: asString(row.uploader_user_id) ?? "",
    uploaderName: asString(row.uploader_name),
    uploaderUsername: asString(row.uploader_username),
    uploaderAvatarUrl: asString(row.uploader_avatar_url),
    createdAt: asString(row.created_at) ?? "",
    isCover: asBoolean(row.is_cover),
    canDelete: asBoolean(row.can_delete),
    canRequestPublic: asBoolean(row.can_request_public),
    canSetCover: asBoolean(row.can_set_cover),
    canComment: asBoolean(row.can_comment),
    appearanceReported: asBoolean(row.appearance_reported),
    tags: rawTags.map(parseTag),
    comments: rawComments.map(parseComment),
  };
}

export function parseExperienceBundle(value: unknown): ExperienceBundle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const rawExperience = asRecord(row.experience);
  const experienceId = asString(rawExperience.id);
  const rawMedia = Array.isArray(row.media) ? row.media : [];
  const rawCandidates = Array.isArray(row.tag_candidates)
    ? row.tag_candidates
    : [];

  return {
    sharedTitle: asString(row.shared_title),
    canonicalActivityName: asString(row.canonical_activity_name),
    experience: experienceId
      ? {
          id: experienceId,
          planId: asString(rawExperience.plan_id) ?? "",
          title: asString(rawExperience.title) ?? "Shared Experience",
          story: asString(rawExperience.story),
          visibility: (asString(rawExperience.visibility) ??
            "participants") as ExperienceVisibility,
          coverMediaId: asString(rawExperience.cover_media_id),
          completedAt: asString(rawExperience.completed_at),
          canManage: asBoolean(rawExperience.can_manage),
          canContribute: asBoolean(rawExperience.can_contribute),
          viewerIsParticipant: asBoolean(
            rawExperience.viewer_is_participant
          ),
        }
      : null,
    media: rawMedia.map(parseMedia),
    tagCandidates: rawCandidates.map(parsePerson),
  };
}

export function getExperienceVisibilityLabel(
  visibility: ExperienceVisibility
) {
  if (visibility === "public") {
    return "Public experience page";
  }

  if (visibility === "friends") {
    return "Friends can view the experience";
  }

  return "Participants only";
}

export function getExperienceProviderLabel(
  provider: ExperienceMediaProvider | null
) {
  if (provider === "direct") {
    return "Direct media link";
  }

  if (provider === "google_photos") {
    return "Google Photos";
  }

  if (provider === "instagram") {
    return "Instagram";
  }

  if (provider === "youtube") {
    return "YouTube";
  }

  if (provider === "vimeo") {
    return "Vimeo";
  }

  return "External link";
}

export function getExperienceMediaPublicStatusLabel(
  status: ExperienceMediaPublicStatus
) {
  if (status === "approved") {
    return "Approved for public cover";
  }

  if (status === "pending") {
    return "Waiting for cover approvals";
  }

  if (status === "rejected") {
    return "Public cover declined";
  }

  if (status === "suspended") {
    return "Public cover paused";
  }

  return "Participants only";
}

export function isStoredExperienceMedia(media: ExperienceMediaItem) {
  return (
    (media.mediaType === "photo" || media.mediaType === "video") &&
    Boolean(media.storagePath)
  );
}

export function isExperiencePhoto(media: ExperienceMediaItem) {
  return media.mediaType === "photo" || media.mediaType === "external_photo";
}

export function isExperienceVideo(media: ExperienceMediaItem) {
  return media.mediaType === "video" || media.mediaType === "external_video";
}
