"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/utils/supabase/client";
import {
  getExperienceMediaPublicStatusLabel,
  getExperienceProviderLabel,
  getExperienceVisibilityLabel,
  isExperiencePhoto,
  isExperienceVideo,
  type ExperienceBundle,
  type ExperienceMediaItem,
  type ExperienceMediaProvider,
  type ExperienceVisibility,
} from "@/utils/experience";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

const ACCEPTED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

type GalleryFilter =
  | "all"
  | "photos"
  | "videos"
  | "links"
  | "approval";

type AddMode = "upload" | "link";
type LinkKind = "photo" | "video" | "album" | "post";

function getPersonName({
  fullName,
  username,
}: {
  fullName: string | null;
  username: string | null;
}) {
  return fullName || username || "UIN member";
}

function getExtension(file: File) {
  const extension = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "video/webm") {
    return "webm";
  }

  if (file.type === "video/quicktime") {
    return "mov";
  }

  if (file.type.startsWith("video/")) {
    return "mp4";
  }

  return "jpg";
}

function getMediaDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getYouTubeId(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v") ||
        parsed.pathname.split("/").filter(Boolean).pop() ||
        null;
    }
  } catch {
    return null;
  }

  return null;
}

function getVimeoId(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .reverse();

    return parts.find((part) => /^\d+$/.test(part)) ?? null;
  } catch {
    return null;
  }
}

function getMediaStatusClasses(media: ExperienceMediaItem) {
  if (media.publicStatus === "approved") {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (media.publicStatus === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    media.publicStatus === "rejected" ||
    media.publicStatus === "suspended"
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-gray-200 bg-white/90 text-gray-700";
}

function MediaVisual({
  media,
  className,
  controls = false,
}: {
  media: ExperienceMediaItem;
  className: string;
  controls?: boolean;
}) {
  if (media.mediaType === "photo" && media.signedUrl) {
    return (
      <img
        src={media.signedUrl}
        alt={media.caption || "Activity photo"}
        className={className}
      />
    );
  }

  if (
    media.mediaType === "external_photo" &&
    media.provider === "direct" &&
    media.externalUrl
  ) {
    return (
      <img
        src={media.externalUrl}
        alt={media.caption || media.label || "Linked Activity photo"}
        className={className}
      />
    );
  }

  if (media.mediaType === "video" && media.signedUrl) {
    return (
      <video
        src={media.signedUrl}
        controls={controls}
        muted={!controls}
        playsInline
        preload="metadata"
        className={className}
      />
    );
  }

  if (media.mediaType === "external_video" && controls) {
    const youtubeId = media.provider === "youtube"
      ? getYouTubeId(media.externalUrl)
      : null;
    const vimeoId = media.provider === "vimeo"
      ? getVimeoId(media.externalUrl)
      : null;

    if (youtubeId) {
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`}
          title={media.label || "Activity video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={className}
        />
      );
    }

    if (vimeoId) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}`}
          title={media.label || "Activity video"}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className={className}
        />
      );
    }

    if (media.provider === "direct" && media.externalUrl) {
      return (
        <video
          src={media.externalUrl}
          controls
          playsInline
          preload="metadata"
          className={className}
        />
      );
    }
  }

  if (media.mediaType === "external_video") {
    const youtubeId = getYouTubeId(media.externalUrl);

    if (youtubeId) {
      return (
        <img
          src={`https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`}
          alt={media.label || "Video preview"}
          className={className}
        />
      );
    }
  }

  return (
    <div className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-center text-white`}>
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl">
          {isExperienceVideo(media) ? "▶" : "↗"}
        </div>
        <p className="mt-3 text-sm font-bold">
          {media.label || getExperienceProviderLabel(media.provider)}
        </p>
        <p className="mt-1 text-xs text-white/65">
          Open linked media
        </p>
      </div>
    </div>
  );
}

export default function ExperiencePanel({
  bundle,
}: {
  bundle: ExperienceBundle;
}) {
  const router = useRouter();
  const experience = bundle.experience;

  const [title, setTitle] = useState(experience?.title ?? "");
  const [story, setStory] = useState(experience?.story ?? "");
  const [visibility, setVisibility] = useState<ExperienceVisibility>(
    experience?.visibility ?? "participants"
  );
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCaption, setUploadCaption] = useState("");
  const [selectedTagUserIds, setSelectedTagUserIds] = useState<string[]>([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [linkKind, setLinkKind] = useState<LinkKind>("video");
  const [provider, setProvider] = useState<ExperienceMediaProvider>("youtube");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalLabel, setExternalLabel] = useState("");
  const [externalCaption, setExternalCaption] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [tagCandidateId, setTagCandidateId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredMedia = useMemo(() => {
    if (galleryFilter === "photos") {
      return bundle.media.filter(isExperiencePhoto);
    }

    if (galleryFilter === "videos") {
      return bundle.media.filter(isExperienceVideo);
    }

    if (galleryFilter === "links") {
      return bundle.media.filter((media) => Boolean(media.externalUrl));
    }

    if (galleryFilter === "approval") {
      return bundle.media.filter((media) =>
        media.tags.some(
          (tag) => tag.isCurrentViewer && tag.status === "pending"
        )
      );
    }

    return bundle.media;
  }, [bundle.media, galleryFilter]);

  const selectedMedia = useMemo(
    () => bundle.media.find((media) => media.id === selectedMediaId) ?? null,
    [bundle.media, selectedMediaId]
  );

  const approvalCount = useMemo(
    () => bundle.media.filter((media) =>
      media.tags.some(
        (tag) => tag.isCurrentViewer && tag.status === "pending"
      )
    ).length,
    [bundle.media]
  );

  if (!experience) {
    return null;
  }

  const currentExperience = experience;

  function showError(fallback: string, error?: { message?: string } | null) {
    setMessage(error?.message || fallback);
  }

  async function updateDetails() {
    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc("update_experience_details", {
      p_experience_id: currentExperience.id,
      p_title: title.trim(),
      p_story: story.trim() || null,
      p_visibility: visibility,
    });

    setIsBusy(false);

    if (error) {
      showError("The Experience could not be updated.", error);
      return;
    }

    setMessage("Experience updated.");
    router.refresh();
  }

  async function tagMedia(mediaId: string) {
    for (const taggedUserId of selectedTagUserIds) {
      const { error } = await supabase.rpc(
        "tag_experience_media_participant",
        {
          p_media_id: mediaId,
          p_tagged_user_id: taggedUserId,
        }
      );

      if (error) {
        console.error("Activity media tag failed:", error);
      }
    }
  }

  async function tagExistingMedia(mediaId: string) {
    if (!tagCandidateId) {
      return;
    }

    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "tag_experience_media_participant",
      {
        p_media_id: mediaId,
        p_tagged_user_id: tagCandidateId,
      }
    );

    setIsBusy(false);

    if (error) {
      showError("The participant could not be tagged.", error);
      return;
    }

    setTagCandidateId("");
    setMessage("Participant tagged. Their approval will be required before public-cover use.");
    router.refresh();
  }

  async function uploadFiles() {
    if (selectedFiles.length === 0) {
      setMessage("Choose at least one photo or video.");
      return;
    }

    for (const file of selectedFiles) {
      const isPhoto = ACCEPTED_PHOTO_TYPES.includes(file.type);
      const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

      if (!isPhoto && !isVideo) {
        setMessage(`${file.name}: use JPG, PNG, WebP, MP4, WebM or MOV.`);
        return;
      }

      if (isPhoto && file.size > MAX_PHOTO_BYTES) {
        setMessage(`${file.name}: photos must be 15 MB or smaller.`);
        return;
      }

      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        setMessage(`${file.name}: videos must be 150 MB or smaller.`);
        return;
      }
    }

    setIsBusy(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsBusy(false);
      setMessage("Sign in again before uploading.");
      return;
    }

    let uploadedCount = 0;

    for (const file of selectedFiles) {
      const mediaType = file.type.startsWith("video/") ? "video" : "photo";
      const storagePath = `${currentExperience.id}/${user.id}/${crypto.randomUUID()}.${getExtension(file)}`;

      const { error: uploadError } = await supabase.storage
        .from("experience-media")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        showError(`${file.name} could not be uploaded.`, uploadError);
        continue;
      }

      const { data: mediaId, error: mediaError } = await supabase.rpc(
        "add_experience_uploaded_media_v2",
        {
          p_experience_id: currentExperience.id,
          p_storage_path: storagePath,
          p_media_type: mediaType,
          p_mime_type: file.type,
          p_original_filename: file.name,
          p_caption: uploadCaption.trim() || null,
        }
      );

      if (mediaError || typeof mediaId !== "string") {
        await supabase.storage.from("experience-media").remove([storagePath]);
        showError(
          `${file.name} was uploaded but could not be attached to the Activity.`,
          mediaError
        );
        continue;
      }

      await tagMedia(mediaId);
      uploadedCount += 1;
    }

    setSelectedFiles([]);
    setUploadCaption("");
    setSelectedTagUserIds([]);
    setUploadInputKey((current) => current + 1);
    setIsBusy(false);

    if (uploadedCount > 0) {
      setMessage(
        `${uploadedCount} media item${uploadedCount === 1 ? "" : "s"} added to the participant gallery.`
      );
      router.refresh();
    }
  }

  async function addExternalMedia() {
    setIsBusy(true);
    setMessage(null);

    const { data: mediaId, error } = await supabase.rpc(
      "add_experience_external_media_v2",
      {
        p_experience_id: currentExperience.id,
        p_media_kind: linkKind,
        p_provider: provider,
        p_url: externalUrl.trim(),
        p_label: externalLabel.trim() || null,
        p_caption: externalCaption.trim() || null,
      }
    );

    if (error || typeof mediaId !== "string") {
      setIsBusy(false);
      showError("The media link could not be added.", error);
      return;
    }

    if (linkKind === "photo" || linkKind === "video") {
      await tagMedia(mediaId);
    }

    setExternalUrl("");
    setExternalLabel("");
    setExternalCaption("");
    setSelectedTagUserIds([]);
    setIsBusy(false);
    setMessage("Media link added to the participant gallery.");
    router.refresh();
  }

  async function deleteMedia(media: ExperienceMediaItem) {
    if (!window.confirm("Remove this item from the Activity gallery?")) {
      return;
    }

    setIsBusy(true);
    setMessage(null);

    const { data: removedStoragePath, error } = await supabase.rpc(
      "remove_experience_media_v2",
      {
        p_media_id: media.id,
      }
    );

    if (error) {
      setIsBusy(false);
      showError("The gallery item could not be removed.", error);
      return;
    }

    if (typeof removedStoragePath === "string" && removedStoragePath) {
      const { error: storageError } = await supabase.storage
        .from("experience-media")
        .remove([removedStoragePath]);

      if (storageError) {
        console.error("Removed Activity media file cleanup failed:", storageError);
      }
    }

    setIsBusy(false);

    setSelectedMediaId(null);
    setMessage("Gallery item removed.");
    router.refresh();
  }

  async function requestPublic(mediaId: string) {
    setIsBusy(true);
    setMessage(null);

    const { data, error } = await supabase.rpc(
      "request_experience_media_publication",
      { p_media_id: mediaId }
    );

    setIsBusy(false);

    if (error) {
      showError("Cover approval could not be requested.", error);
      return;
    }

    setMessage(
      data === "approved"
        ? "Cover approval completed. This photo may now be selected as the public Activity cover."
        : "Cover approval request sent to tagged participants."
    );
    router.refresh();
  }

  async function cancelPublic(mediaId: string) {
    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "cancel_experience_media_publication",
      { p_media_id: mediaId }
    );

    setIsBusy(false);

    if (error) {
      showError("The cover approval request could not be cancelled.", error);
      return;
    }

    setMessage("The photo is participant-only again.");
    router.refresh();
  }

  async function setCover(mediaId: string) {
    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc("set_experience_cover_media_v2", {
      p_experience_id: currentExperience.id,
      p_media_id: mediaId,
    });

    setIsBusy(false);

    if (error) {
      showError("The public Activity cover could not be changed.", error);
      return;
    }

    setMessage("Public Activity cover updated.");
    router.refresh();
  }

  async function respondToTag(
    tagId: string,
    response: "approved" | "declined" | "removed"
  ) {
    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "respond_to_experience_media_tag",
      {
        p_tag_id: tagId,
        p_status: response,
      }
    );

    setIsBusy(false);

    if (error) {
      showError("Your approval choice could not be saved.", error);
      return;
    }

    setMessage(
      response === "approved"
        ? "You approved this tag and the pending public-cover request."
        : "Public-cover use is blocked for this version of the media."
    );
    router.refresh();
  }

  async function reportAppearance(mediaId: string) {
    if (!window.confirm(
      "Report that you appear in this media? Public-cover use will be paused immediately."
    )) {
      return;
    }

    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "report_experience_media_appearance",
      {
        p_media_id: mediaId,
        p_note: "Participant reports appearing in this media.",
      }
    );

    setIsBusy(false);

    if (error) {
      showError("The appearance report could not be submitted.", error);
      return;
    }

    setMessage("Public-cover use has been paused for this media.");
    router.refresh();
  }

  async function addComment(mediaId: string) {
    const body = commentBody.trim();

    if (!body) {
      return;
    }

    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc("add_experience_media_comment", {
      p_media_id: mediaId,
      p_body: body,
    });

    setIsBusy(false);

    if (error) {
      showError("The comment could not be added.", error);
      return;
    }

    setCommentBody("");
    router.refresh();
  }

  async function deleteComment(commentId: string) {
    setIsBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc(
      "delete_experience_media_comment",
      { p_comment_id: commentId }
    );

    setIsBusy(false);

    if (error) {
      showError("The comment could not be removed.", error);
      return;
    }

    router.refresh();
  }

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-purple-200 bg-white shadow-sm">
      <div className="border-b border-purple-100 bg-gradient-to-r from-purple-50 via-white to-indigo-50 p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
          Activity memories
        </p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">
              {currentExperience.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              The full gallery is private to Activity participants. Only an approved photo may be used as the public Activity cover, and every tagged person must approve first.
            </p>
          </div>

          <span className="rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700">
            {getExperienceVisibilityLabel(currentExperience.visibility)}
          </span>
        </div>
      </div>

      {currentExperience.canManage && (
        <div className="border-b border-gray-100 p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Experience details
          </p>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Shared title
              </span>
              <input
                type="text"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Shared story, optional
              </span>
              <textarea
                rows={4}
                maxLength={2000}
                value={story}
                onChange={(event) => setStory(event.target.value)}
                placeholder="What happened, what made it memorable, or what the group would like to remember."
                className="resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Experience page visibility
              </span>
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as ExperienceVisibility)
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
              >
                <option value="participants">Participants only</option>
                <option value="friends">Friends of participants</option>
                <option value="public">Public</option>
              </select>
              <span className="text-xs leading-5 text-gray-500">
                This controls the story page. Gallery media remains participant-only. Only the selected, fully approved cover photo is visible outside the Activity.
              </span>
            </label>

            <div>
              <button
                type="button"
                disabled={isBusy || !title.trim()}
                onClick={updateDetails}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Experience
              </button>
            </div>
          </div>
        </div>
      )}

      {currentExperience.story && (
        <div className="border-b border-gray-100 p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Story
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
            {currentExperience.story}
          </p>
        </div>
      )}

      {currentExperience.viewerIsParticipant && (
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
              Participant gallery
            </p>
            <h3 className="mt-2 text-xl font-bold text-gray-950">
              Photos, videos and links
            </h3>
          </div>

          <span className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
            {bundle.media.length} item{bundle.media.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ["all", `All ${bundle.media.length}`],
            ["photos", "Photos"],
            ["videos", "Videos"],
            ["links", "Links"],
            ["approval", `Awaiting my approval ${approvalCount}`],
          ] as Array<[GalleryFilter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGalleryFilter(value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                galleryFilter === value
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredMedia.length > 0 ? (
          <div className="mt-5 grid auto-rows-[190px] grid-cols-2 gap-3 md:auto-rows-[230px] md:grid-cols-3">
            {filteredMedia.map((media, index) => (
              <button
                key={media.id}
                type="button"
                onClick={() => {
                  setSelectedMediaId(media.id);
                  setTagCandidateId("");
                }}
                className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                  index === 0 && filteredMedia.length > 2
                    ? "col-span-2 row-span-2"
                    : ""
                }`}
              >
                <MediaVisual
                  media={media}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 pt-12 text-white">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {media.caption || media.label ||
                          (isExperienceVideo(media) ? "Activity video" : "Activity photo")}
                      </p>
                      <p className="mt-1 text-[11px] text-white/70">
                        {media.uploaderName || media.uploaderUsername || "UIN member"}
                        {media.comments.length > 0
                          ? ` · ${media.comments.length} comment${media.comments.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>

                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${getMediaStatusClasses(media)}`}>
                      {media.isCover && media.publicStatus === "approved"
                        ? "Public cover"
                        : media.publicStatus === "approved"
                          ? "Cover approved"
                          : media.publicStatus === "pending"
                            ? "Cover approval pending"
                            : "Private"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No media matches this filter.
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Participant uploads will appear here with private previews and approval status.
            </p>
          </div>
        )}
        </div>
      )}

      {currentExperience.canContribute && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                Add media
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-950">
                Share with Activity participants
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Uploads are private by default. Linked media remains controlled by its external provider, so upload files when privacy matters.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setAddMode("upload")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  addMode === "upload" ? "bg-gray-950 text-white" : "text-gray-600"
                }`}
              >
                Upload files
              </button>
              <button
                type="button"
                onClick={() => setAddMode("link")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  addMode === "link" ? "bg-gray-950 text-white" : "text-gray-600"
                }`}
              >
                Add link
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
            {addMode === "upload" ? (
              <div className="grid gap-4">
                <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 p-6 text-center transition hover:border-green-400">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-xl text-white">
                    +
                  </span>
                  <span className="mt-3 text-sm font-bold text-gray-950">
                    Choose photos or short videos
                  </span>
                  <span className="mt-1 text-xs leading-5 text-gray-500">
                    JPG, PNG, WebP up to 15 MB. MP4, WebM or MOV up to 150 MB.
                  </span>
                  <input
                    key={uploadInputKey}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                    onChange={(event) =>
                      setSelectedFiles(Array.from(event.target.files ?? []))
                    }
                    className="sr-only"
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs font-bold text-gray-700">
                      {selectedFiles.length} selected
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedFiles.map((file) => (
                        <span
                          key={`${file.name}-${file.size}`}
                          className="max-w-full truncate rounded-full bg-white px-3 py-1 text-xs text-gray-600"
                        >
                          {file.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  maxLength={240}
                  value={uploadCaption}
                  onChange={(event) => setUploadCaption(event.target.value)}
                  placeholder="Caption for these items, optional"
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-500"
                />

                <TagPicker
                  candidates={bundle.tagCandidates}
                  selectedIds={selectedTagUserIds}
                  onChange={setSelectedTagUserIds}
                />

                <button
                  type="button"
                  disabled={isBusy || selectedFiles.length === 0}
                  onClick={uploadFiles}
                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? "Uploading..." : "Upload to participant gallery"}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-gray-600">Media type</span>
                  <select
                    value={linkKind}
                    onChange={(event) => setLinkKind(event.target.value as LinkKind)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="photo">Photo link</option>
                    <option value="video">Video link</option>
                    <option value="album">Photo album</option>
                    <option value="post">Other post</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-gray-600">Provider</span>
                  <select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as ExperienceMediaProvider)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="direct">Direct media URL</option>
                    <option value="google_photos">Google Photos</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="other">Other HTTPS link</option>
                  </select>
                </label>

                <input
                  type="url"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  placeholder="https://..."
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 md:col-span-2"
                />

                <input
                  type="text"
                  maxLength={100}
                  value={externalLabel}
                  onChange={(event) => setExternalLabel(event.target.value)}
                  placeholder="Label, optional"
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />

                <input
                  type="text"
                  maxLength={240}
                  value={externalCaption}
                  onChange={(event) => setExternalCaption(event.target.value)}
                  placeholder="Caption, optional"
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />

                {(linkKind === "photo" || linkKind === "video") && (
                  <div className="md:col-span-2">
                    <TagPicker
                      candidates={bundle.tagCandidates}
                      selectedIds={selectedTagUserIds}
                      onChange={setSelectedTagUserIds}
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={isBusy || !externalUrl.trim()}
                  onClick={addExternalMedia}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
                >
                  {isBusy ? "Adding..." : "Add link to participant gallery"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className="border-t border-gray-100 bg-gray-950 px-5 py-3 text-sm font-semibold text-white md:px-6">
          {message}
        </div>
      )}

      {selectedMedia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activity media"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm md:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setSelectedMediaId(null);
            }
          }}
        >
          <div className="grid max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[minmax(0,1.6fr)_minmax(330px,0.7fr)]">
            <div className="relative flex min-h-[42vh] items-center justify-center bg-black lg:min-h-[78vh]">
              <MediaVisual
                media={selectedMedia}
                controls
                className="max-h-[78vh] w-full object-contain"
              />

              <button
                type="button"
                onClick={() => setSelectedMediaId(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white backdrop-blur"
                aria-label="Close media"
              >
                ×
              </button>
            </div>

            <div className="flex max-h-[94vh] min-h-0 flex-col bg-white">
              <div className="border-b border-gray-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                      Activity media
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-gray-950">
                      {selectedMedia.caption || selectedMedia.label ||
                        (isExperienceVideo(selectedMedia) ? "Activity video" : "Activity photo")}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Added by {selectedMedia.uploaderName || selectedMedia.uploaderUsername || "UIN member"}
                      {getMediaDate(selectedMedia.createdAt)
                        ? ` · ${getMediaDate(selectedMedia.createdAt)}`
                        : ""}
                    </p>
                  </div>

                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getMediaStatusClasses(selectedMedia)}`}>
                    {getExperienceMediaPublicStatusLabel(selectedMedia.publicStatus)}
                  </span>
                </div>

                {selectedMedia.externalUrl && (
                  <a
                    href={selectedMedia.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Open original link ↗
                  </a>
                )}

                {selectedMedia.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedMedia.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          tag.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : tag.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {getPersonName({
                          fullName: tag.fullName,
                          username: tag.username,
                        })}
                        {tag.status === "pending" ? " · pending" : ""}
                        {tag.status === "declined" || tag.status === "removed"
                          ? " · declined"
                          : ""}
                      </span>
                    ))}
                  </div>
                )}

                {currentExperience.canContribute &&
                  (isExperiencePhoto(selectedMedia) || isExperienceVideo(selectedMedia)) &&
                  bundle.tagCandidates.some(
                    (candidate) => !selectedMedia.tags.some(
                      (tag) => tag.taggedUserId === candidate.userId
                    )
                  ) && (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
                        Tag another participant
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        Tag everyone who appears. Tagged people must approve before this photo can become the public cover.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <select
                          value={tagCandidateId}
                          onChange={(event) => setTagCandidateId(event.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-purple-500"
                        >
                          <option value="">Select participant</option>
                          {bundle.tagCandidates
                            .filter(
                              (candidate) => !selectedMedia.tags.some(
                                (tag) => tag.taggedUserId === candidate.userId
                              )
                            )
                            .map((candidate) => (
                              <option key={candidate.userId} value={candidate.userId}>
                                {getPersonName({
                                  fullName: candidate.fullName,
                                  username: candidate.username,
                                })}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={isBusy || !tagCandidateId}
                          onClick={() => tagExistingMedia(selectedMedia.id)}
                          className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Tag
                        </button>
                      </div>
                    </div>
                  )}

                {selectedMedia.tags.some(
                  (tag) => tag.isCurrentViewer && tag.status === "pending"
                ) && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-950">
                      You were tagged in this media
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      Approving permits this photo to be used as the public Activity cover if every other tagged person also approves.
                    </p>
                    <div className="mt-3 flex gap-2">
                      {selectedMedia.tags
                        .filter(
                          (tag) => tag.isCurrentViewer && tag.status === "pending"
                        )
                        .map((tag) => (
                          <div key={tag.id} className="flex gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => respondToTag(tag.id, "approved")}
                              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => respondToTag(tag.id, "declined")}
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700"
                            >
                              Decline cover use
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedMedia.canRequestPublic && selectedMedia.publicStatus === "private" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => requestPublic(selectedMedia.id)}
                      className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Request cover approval
                    </button>
                  )}

                  {selectedMedia.canRequestPublic && selectedMedia.publicStatus === "pending" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => cancelPublic(selectedMedia.id)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                    >
                      Cancel cover request
                    </button>
                  )}

                  {selectedMedia.canSetCover && !selectedMedia.isCover && isExperiencePhoto(selectedMedia) && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setCover(selectedMedia.id)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
                    >
                      Use as public cover
                    </button>
                  )}

                  {currentExperience.viewerIsParticipant &&
                    !selectedMedia.appearanceReported &&
                    (isExperiencePhoto(selectedMedia) || isExperienceVideo(selectedMedia)) && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => reportAppearance(selectedMedia.id)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                      >
                        I appear in this media
                      </button>
                    )}

                  {selectedMedia.canDelete && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => deleteMedia(selectedMedia)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {selectedMedia.publicRejectionLocked && (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                    A participant declined or reported this version. It cannot be used as a public cover. Upload a revised crop or a different photo.
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-gray-950">
                    Participant comments
                  </h4>
                  <span className="text-xs text-gray-500">
                    {selectedMedia.comments.length}
                  </span>
                </div>

                {selectedMedia.comments.length > 0 ? (
                  <div className="mt-4 grid gap-4">
                    {selectedMedia.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        {comment.avatarUrl ? (
                          <img
                            src={comment.avatarUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                            {(comment.fullName || comment.username || "U").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 rounded-2xl bg-gray-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-gray-900">
                                {getPersonName({
                                  fullName: comment.fullName,
                                  username: comment.username,
                                })}
                              </p>
                              <p className="mt-0.5 text-[10px] text-gray-400">
                                {getMediaDate(comment.createdAt)}
                              </p>
                            </div>
                            {comment.canDelete && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => deleteComment(comment.id)}
                                className="text-[10px] font-semibold text-red-600"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-6 text-center text-xs leading-5 text-gray-500">
                    No participant comments yet.
                  </p>
                )}
              </div>

              {selectedMedia.canComment && (
                <div className="border-t border-gray-100 p-4">
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder="Write a comment for Activity participants..."
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    disabled={isBusy || !commentBody.trim()}
                    onClick={() => addComment(selectedMedia.id)}
                    className="mt-2 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add comment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TagPicker({
  candidates,
  selectedIds,
  onChange,
}: {
  candidates: ExperienceBundle["tagCandidates"];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <fieldset className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <legend className="px-1 text-xs font-semibold text-gray-600">
        Tag people who appear, optional
      </legend>
      <p className="mt-1 text-[11px] leading-5 text-gray-500">
        Every tagged person must approve before this photo can be used as the public Activity cover.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {candidates.map((person) => {
          const checked = selectedIds.includes(person.userId);

          return (
            <label
              key={person.userId}
              className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((userId) => userId !== person.userId)
                      : [...selectedIds, person.userId]
                  )
                }
              />
              <span className="font-semibold text-gray-800">
                {getPersonName({
                  fullName: person.fullName,
                  username: person.username,
                })}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
