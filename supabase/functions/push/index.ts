import { withSupabase } from 'npm:@supabase/server@^1'

type NotificationRecord = {
  id: string
  user_id: string
  notification_type: string | null
  entity_type: string | null
  entity_id: string | null
  title: string | null
  body: string | null
  action_url: string | null
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: NotificationRecord
  old_record: NotificationRecord | null
}

type PushDevice = {
  id: string
  expo_push_token: string
}

type ExpoTicket = {
  status?: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}

const UIN_ACTIVITY_MESSAGE_CHANNEL = 'activity_messages_uin_v1'
const UIN_UPDATE_CHANNEL = 'uin_updates_uin_v1'
const UIN_INTENT_LIKE_CHANNEL = 'intent_likes_uin_v1'
const UIN_INTENT_PAW_CHANNEL = 'intent_paws_uin_v1'

function channelFor(notificationType: string | null) {
  const type = (notificationType ?? '').toLowerCase()

  if (type === 'intent_liked') return UIN_INTENT_LIKE_CHANNEL
  if (type === 'intent_pawed') return UIN_INTENT_PAW_CHANNEL
  if (type.includes('room_message') || type.includes('message') || type.includes('chat')) {
    return UIN_ACTIVITY_MESSAGE_CHANNEL
  }
  return UIN_UPDATE_CHANNEL
}

// UIN_NOTIFICATION_NOISE_POLICY_V1
// Room pushes are transport events. The same room should occupy one visible
// notification card instead of stacking one card per message.
function notificationGroupKey(notification: NotificationRecord) {
  const type = (notification.notification_type ?? '').toLowerCase()
  const entityType = (notification.entity_type ?? '').toLowerCase()
  const entityId = notification.entity_id

  if (!entityId) return null

  if (entityType === 'plan' && type.includes('room_message')) {
    return `uin-room-${entityId}`
  }

  return null
}
export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    const payload = (await req.json()) as WebhookPayload
    if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record?.user_id) {
      return Response.json({ ok: true, skipped: true })
    }

    const notification = payload.record
    const notificationType = (notification.notification_type ?? '').toLowerCase()

    // Defense in depth: this event is discovery-only and must never become a push.
    if (notificationType === 'followed_profile_public_intent') {
      return Response.json({
        ok: true,
        skipped: true,
        reason: 'followed-profile-public-intent-is-discovery-only',
      })
    }

    const groupKey = notificationGroupKey(notification)
    const { data: devices, error } = await ctx.supabaseAdmin
      .from('user_push_devices')
      .select('id, expo_push_token')
      .eq('user_id', notification.user_id)
      .eq('enabled', true)

    if (error) {
      console.error('push device lookup failed', error)
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    const activeDevices = (devices ?? []) as PushDevice[]
    if (activeDevices.length === 0) {
      return Response.json({ ok: true, delivered: 0 })
    }

    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    const messages = activeDevices.map((device) => ({
      to: device.expo_push_token,
      sound: 'uin_push_background.wav',
      title: notification.title ?? 'UIN',
      body: notification.body ?? 'Yeni bir bildirimin var.',
      channelId: channelFor(notification.notification_type),
      priority: 'high',
      // collapseId coalesces messages in transit. tag replaces an already
      // displayed Android notification with the newest message from this room.
      ...(groupKey ? { collapseId: groupKey, tag: groupKey } : {}),
      data: {
        notificationId: notification.id,
        notificationType: notification.notification_type,
        entityType: notification.entity_type,
        entityId: notification.entity_id,
        actionUrl: notification.action_url,
      },
    }))

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    })

    const result = await expoResponse.json()
    const rawTickets = Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : []
    const tickets = rawTickets as ExpoTicket[]

    const invalidIds: string[] = []
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const device = activeDevices[index]
        if (device?.id) invalidIds.push(device.id)
      }
    })

    if (invalidIds.length > 0) {
      await ctx.supabaseAdmin
        .from('user_push_devices')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in('id', invalidIds)
    }

    return Response.json({
      ok: expoResponse.ok,
      delivered: activeDevices.length,
      invalidated: invalidIds.length,
      expo: result,
    }, { status: expoResponse.ok ? 200 : 502 })
  }),
}
