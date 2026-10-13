import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiscoverIntentRow, IntentLifecycleStatus } from '@/components/discover/DiscoverIntentCard';
import { resolveActivityCover } from '@/utils/activityCover';

type Row = Record<string, any>;
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

// Uses the same visibility reader as the event detail screen, in bounded batches.
export async function loadTopicEventCards(db: SupabaseClient, events: Row[]) {
  const cards = new Map<string, DiscoverIntentRow>();
  for (let offset = 0; offset < events.length; offset += 100) {
    const batch = events.slice(offset, offset + 100);
    const ids = batch.map(event => String(event.plan_id || event.resource_id || event.intent_id));
    const plans = batch.map(event => event.plan_id).filter(Boolean);
    const [details, presentations, covers] = await Promise.all([
      db.rpc('get_visible_event_card_details_batch_v182', { p_resource_ids: ids }),
      db.rpc('get_uin_event_presentations_v150', { p_resource_ids: ids }),
      plans.length ? db.rpc('get_visible_plan_presentations', { p_plan_ids: plans }) : Promise.resolve({ data: [], error: null }),
    ]);
    if ([details, presentations, covers].some(result => result.error || !Array.isArray(result.data))) throw new Error('Etkinlik kartları yüklenemedi.');
    const detailById = new Map((details.data as Row[]).map(row => [row.resource_id, row.detail]));
    const presentationById = new Map((presentations.data as Row[]).map(row => [row.resource_id, row.presentation]));
    const coverById = new Map((covers.data as Row[]).map(row => [row.plan_id, row]));
    const activityIds = [...new Set((presentations.data as Row[]).map(row => row.presentation?.activityId).filter(Boolean))];
    const activityResult = activityIds.length ? await db.from('activities').select('id,cover_url:default_cover_url,category_id,activity_categories(cover_url:default_cover_url)').in('id', activityIds) : { data: [], error: null };
    if (activityResult.error || !Array.isArray(activityResult.data)) throw new Error('Etkinlik kapakları yüklenemedi.');
    const activityById = new Map((activityResult.data as Row[]).map(row => [row.id, row]));
    for (const event of batch) {
      const id = String(event.plan_id || event.resource_id || event.intent_id);
      const detail = detailById.get(id), presentation = presentationById.get(id);
      // A resource can have become private since the parent projection was read.
      if (!detail) continue;
      if (!object(detail.activity) || !object(detail.viewer) || !object(presentation)) throw new Error('Etkinlik kartı bilgileri eksik geldi.');
      const a = detail.activity, v = detail.viewer, activity = activityById.get(presentation.activityId);
      const cover = coverById.get(a.plan_id);
      const members = (Array.isArray(event.participants) ? event.participants : []) as Row[];
      const ownerId = a.host_user_id || event.owner_user_id;
      const state = event.event_state;
      const status: IntentLifecycleStatus = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : state === 'expired' ? 'expired' : ['forming','planned','closed','future','open'].includes(a.status) ? a.status : 'open';
      const participantCount = Number(a.participant_count);
      if (a.participant_count === null || a.participant_count === undefined || !Number.isSafeInteger(participantCount) || participantCount < 0) throw new Error('Etkinlik katılımcı sayısı eksik geldi.');
      cards.set(String(event.intent_id), {
        intent_id: a.intent_id || event.intent_id, resource_id: a.resource_id || id, plan_id: a.plan_id || null, plan_status: a.plan_id ? a.status : null,
        owner_user_id: ownerId, owner_full_name: a.host_full_name || event.owner_name, owner_username: a.host_username || null, owner_avatar_url: a.host_avatar_url || event.owner_avatar_url || null,
        activity_id: presentation.activityId, activity_name: a.activity_name,
        event_display_title: presentation.displayTitle || presentation.eventLabel || a.activity_name,
        event_dna_titles: [...new Set((presentation.dnaCards || []).map((row: Row) => row.title).filter(Boolean))] as string[],
        activity_cover_url: activity?.cover_url || null, category_id: presentation.categoryId || activity?.category_id || '', category_name: a.category_name,
        category_cover_url: activity?.activity_categories?.cover_url || null,
        context_cover_url: resolveActivityCover({planCoverUrl: cover?.cover_url || a.cover_url, activityCoverUrl: activity?.cover_url, categoryCoverUrl: activity?.activity_categories?.cover_url, categoryName: a.category_name, activityName: a.activity_name}),
        plan_cover_url: cover?.cover_url || a.cover_url || null,
        location_id: '', city: a.city, district: a.district,
        start_date: a.window_start || event.start_date, end_date: a.window_end || event.end_date, scheduled_start: a.scheduled_start, scheduled_end: a.scheduled_end, timezone: a.timezone || 'Europe/Istanbul', completed_at: a.completed_at, cancelled_at: null,
        people: String(participantCount + 1), active_participant_count: participantCount, budget: a.budget, recurrence: '', visibility: a.visibility, intent_type: 'social', intent_status: event.status,
        recruitment_status: a.recruitment_status, matching_status: 'closed', expired_at: null, lifecycle_status: status, max_participants: a.max_participants,
        // Join availability comes from the existing server permission reader.
        participant_eligibility: 'everyone', viewer_is_eligible: v.can_request === true || v.is_member === true, viewer_can_request: v.can_request === true, viewer_is_member: v.is_member === true,
        viewer_invitation_status: v.invitation_status, viewer_request_status: v.join_request_status, viewer_request_id: v.join_request_id,
        created_at: '', relevance: 0, total_count: batch.length,
        activity_people: [...new Map(members.map(person => [person.user_id, {userId: person.user_id, fullName: person.full_name, username: person.username || null, avatarUrl: person.avatar_url, role: person.user_id === ownerId ? 'host' : person.role === 'co_host' ? 'co_host' : 'participant'}])).values()],
      });
    }
  }
  return cards;
}
