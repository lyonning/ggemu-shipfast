declare module 'cloudflare:workers' {
  // Minimal structural type for the R2 bucket binding used by the
  // wishlist feature (bucket: retroplay-data).
  export interface R2BucketBinding {
    get(
      key: string,
    ): Promise<{ text(): Promise<string> } | null>
    put(key: string, value: string): Promise<unknown>
  }

  export const env: Record<string, string | undefined> & {
    GG_DEALS_API_KEY?: string
    DATA_BUCKET?: R2BucketBinding
  }
}
