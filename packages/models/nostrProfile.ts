export const RELAY = process.env.NEXT_PUBLIC_NOSTR_RELAY as string

export interface NostrProfile {
  pubkey?: string
  relays?: string[]
  banner?: string
  damus_donation_v2?: number
  website?: string
  nip05?: string
  picture?: string
  lud16?: string
  lud06?: string
  display_name?: string
  about?: string
  name?: string
}
