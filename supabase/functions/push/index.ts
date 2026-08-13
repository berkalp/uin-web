import { withSupabase } from '@supabase/server'

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

function channelFor(notificationType: string | null) {
  const type = (notificationType ?? '').toLowerCase()
  return type.includes('room_message') || type.includes('message') || type.includes('chat')
    ? 'activity_messages'
    : 'uin_updates'
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    const payload = (await req.json()) as WebhookPayload
    if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record?.user_id) {
      return Response.json({ ok: true, skipped: true })
    }

    const notification = payload.record
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
      sound: 'default',
      title: notification.title ?? 'UIN',
      body: notification.body ?? 'Yeni bir bildirimin var.',
      channelId: channelFor(notification.notification_type),
      priority: 'high',
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
