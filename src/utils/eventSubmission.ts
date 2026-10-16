// One submission owns a stable retry key until its payload changes.
// The key is an opaque deduplication token, not an authentication credential.
export class EventSubmission {
  private busy = false;
  private fingerprint = '';
  private key = '';
  constructor(private readonly newKey = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`) {}
  begin() {
    if (this.busy) return false;
    this.busy = true;
    return true;
  }
  end() { this.busy = false; }
  requestId(payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    if (!this.key || fingerprint !== this.fingerprint) {
      this.key = this.newKey();
      this.fingerprint = fingerprint;
    }
    return this.key;
  }
}

export class DuplicateCardEventError extends Error {
  constructor(public readonly intentId: string, public readonly planId: string | null) {
    super('Bu kartta aynı tür, yer ve tarihler için zaten bir etkinliğin var. Mevcut etkinliği açıp düzenleyebilirsin.');
    this.name = 'DuplicateCardEventError';
  }
}

export function duplicateCardEventError(error: unknown): DuplicateCardEventError | null {
  if (!error || typeof error !== 'object' || !('details' in error) || typeof error.details !== 'string') return null;
  try {
    const detail = JSON.parse(error.details);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (detail.kind === 'duplicate_card_event' && typeof detail.intent_id === 'string' && uuid.test(detail.intent_id)) {
      return new DuplicateCardEventError(detail.intent_id,
        typeof detail.plan_id === 'string' && uuid.test(detail.plan_id) ? detail.plan_id : null);
    }
  } catch { /* Ordinary database errors keep their existing handling. */ }
  return null;
}
