import { supabase } from "@/utils/supabase/client";

export type StaffCapability =
  | "staff_messaging"
  | "member_messaging"
  | "edit_profiles";

export type DirectConversationSummary = {
  conversation_id: string;
  other_user_id: string;
  other_full_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number | string | null;
  viewer_can_send: boolean;
  viewer_access_kind: "staff" | "granted" | null;
  viewer_access_expires_at: string | null;
};

export type DirectConversationMessage = {
  message_id: string;
  sender_id: string;
  sender_full_name: string | null;
  sender_username: string | null;
  sender_avatar_url: string | null;
  body: string;
  created_at: string;
};

export type DirectConversationDetail = {
  conversation_id: string;
  other_user_id: string;
  other_full_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  viewer_can_send: boolean;
  viewer_access_kind: "staff" | "granted" | null;
  viewer_access_expires_at: string | null;
  other_access_kind: "staff" | "granted" | null;
  other_access_expires_at: string | null;
  other_access_revoked_at: string | null;
  viewer_can_manage_access: boolean;
  other_is_staff: boolean;
};

export async function openStaffConversation(input: {
  targetUserId: string;
  body: string;
  memberAccessExpiresAt: string | null;
}) {
  const { data, error } = await supabase.rpc(
    "open_staff_conversation",
    {
      p_target_user_id: input.targetUserId,
      p_body: input.body,
      p_member_access_expires_at:
        input.memberAccessExpiresAt,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "The conversation could not be opened."
    );
  }

  return data as string;
}

export async function sendDirectMessage(
  conversationId: string,
  body: string
) {
  const { data, error } = await supabase.rpc(
    "send_direct_message",
    {
      p_conversation_id: conversationId,
      p_body: body,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "The message could not be sent."
    );
  }

  return data as string;
}

export async function markDirectConversationRead(
  conversationId: string
) {
  const { error } = await supabase.rpc(
    "mark_direct_conversation_read",
    {
      p_conversation_id: conversationId,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "Conversation read state could not be updated."
    );
  }
}

export async function extendDirectConversationAccess(input: {
  conversationId: string;
  targetUserId: string;
  expiresAt: string;
}) {
  const { error } = await supabase.rpc(
    "extend_direct_conversation_access",
    {
      p_conversation_id: input.conversationId,
      p_target_user_id: input.targetUserId,
      p_expires_at: input.expiresAt,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "Messaging access could not be extended."
    );
  }
}

export async function revokeDirectConversationAccess(input: {
  conversationId: string;
  targetUserId: string;
}) {
  const { error } = await supabase.rpc(
    "revoke_direct_conversation_access",
    {
      p_conversation_id: input.conversationId,
      p_target_user_id: input.targetUserId,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "Messaging access could not be revoked."
    );
  }
}

export async function setStaffCapability(input: {
  targetUserId: string;
  capability: StaffCapability;
  enabled: boolean;
}) {
  const { error } = await supabase.rpc(
    "set_staff_capability",
    {
      p_target_user_id: input.targetUserId,
      p_capability: input.capability,
      p_enabled: input.enabled,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "Staff permission could not be updated."
    );
  }
}

export async function adminUpdateUserProfile(input: {
  userId: string;
  fullName: string;
  username: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  reason: string | null;
}) {
  const { data, error } = await supabase.rpc(
    "admin_update_user_profile",
    {
      p_user_id: input.userId,
      p_full_name: input.fullName,
      p_username: input.username,
      p_bio: input.bio,
      p_city: input.city,
      p_country: input.country,
      p_avatar_url: input.avatarUrl,
      p_cover_url: input.coverUrl,
      p_reason: input.reason,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "The profile could not be updated."
    );
  }

  return data as string;
}
