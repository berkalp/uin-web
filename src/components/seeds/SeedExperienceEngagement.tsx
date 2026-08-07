import {
  addSeedExperienceComment,
  setSeedExperienceCommentPolicy,
  setSeedExperienceReaction,
} from "@/app/seeds/explore/actions";

export type SeedExperienceCommentPreview = {
  comment_id: string;
  parent_comment_id: string | null;
  comment_kind: "comment" | "question";
  body: string | null;
  created_at: string;
  deleted_at: string | null;
  author: {
    user_id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
};

export type SeedExperienceEngagementData = {
  inspired_count: number;
  viewer_saved: boolean;
  viewer_inspired: boolean;
  comment_count: number;
  viewer_can_comment: boolean;
  is_owner: boolean;
};

type SeedExperienceEngagementProps = {
  seedId: string;
  engagement: SeedExperienceEngagementData;
  comments: SeedExperienceCommentPreview[];
  commentPolicy: "everyone" | "friends" | "same_seed" | "off";
  returnTo: string;
};

function authorName(comment: SeedExperienceCommentPreview): string {
  return (
    comment.author.full_name ||
    comment.author.username ||
    "UIN member"
  );
}

export default function SeedExperienceEngagement({
  seedId,
  engagement,
  comments,
  commentPolicy,
  returnTo,
}: SeedExperienceEngagementProps) {
  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <div className="flex flex-wrap items-center gap-2">
        {!engagement.is_owner && (
          <>
            <form action={setSeedExperienceReaction}>
              <input type="hidden" name="seed_id" value={seedId} />
              <input type="hidden" name="reaction_type" value="inspired" />
              <input
                type="hidden"
                name="active"
                value={engagement.viewer_inspired ? "false" : "true"}
              />
              <input type="hidden" name="return_to" value={returnTo} />
              <button
                type="submit"
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  engagement.viewer_inspired
                    ? "bg-amber-100 text-amber-900"
                    : "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
                }`}
              >
                {engagement.viewer_inspired ? "✓ Inspired" : "Inspired"}
                {engagement.inspired_count > 0
                  ? ` · ${engagement.inspired_count}`
                  : ""}
              </button>
            </form>

            <form action={setSeedExperienceReaction}>
              <input type="hidden" name="seed_id" value={seedId} />
              <input type="hidden" name="reaction_type" value="save" />
              <input
                type="hidden"
                name="active"
                value={engagement.viewer_saved ? "false" : "true"}
              />
              <input type="hidden" name="return_to" value={returnTo} />
              <button
                type="submit"
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  engagement.viewer_saved
                    ? "bg-gray-950 text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:border-gray-950"
                }`}
              >
                {engagement.viewer_saved
                  ? "✓ Experience saved"
                  : "Save Experience"}
              </button>
            </form>
          </>
        )}

        <span className="ml-auto text-xs font-bold text-gray-500">
          {engagement.comment_count} comment
          {engagement.comment_count === 1 ? "" : "s"}
        </span>
      </div>

      {comments.length > 0 && (
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.comment_id}
              className="rounded-2xl bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-black text-gray-800">
                  {authorName(comment)}
                </p>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-gray-500">
                  {comment.comment_kind}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm leading-5 text-gray-700">
                {comment.deleted_at ? "Comment removed." : comment.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {engagement.is_owner && (
        <form
          action={setSeedExperienceCommentPolicy}
          className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 p-3"
        >
          <input type="hidden" name="seed_id" value={seedId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <span className="text-xs font-black text-gray-600">Comments:</span>
          <select
            name="comment_policy"
            defaultValue={commentPolicy}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700"
          >
            <option value="everyone">Everyone</option>
            <option value="friends">Friends</option>
            <option value="same_seed">People with the same Seed</option>
            <option value="off">Off</option>
          </select>
          <button
            type="submit"
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-black text-gray-800 hover:border-gray-950"
          >
            Update
          </button>
        </form>
      )}

      {engagement.viewer_can_comment && (
        <form action={addSeedExperienceComment} className="mt-4 grid gap-2">
          <input type="hidden" name="seed_id" value={seedId} />
          <input type="hidden" name="return_to" value={returnTo} />

          <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
            <select
              name="comment_kind"
              defaultValue="comment"
              className="rounded-2xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-emerald-600"
            >
              <option value="comment">Comment</option>
              <option value="question">Question</option>
            </select>
            <input
              name="body"
              required
              minLength={2}
              maxLength={2000}
              placeholder="Add something useful to this experience…"
              className="min-w-0 rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              type="submit"
              className="rounded-2xl bg-gray-950 px-4 py-2 text-xs font-black text-white hover:bg-gray-800"
            >
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
