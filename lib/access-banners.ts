export const FLAG_CODES = ["MA", "DZ", "DE", "SA", "BE", "CA", "CN", "AE", "ES", "US", "FR", "IT", "JP", "MR", "PT", "QA", "GB", "SN", "TN", "TR"] as const;
export type FlagCode = typeof FLAG_CODES[number];
export type AccessBanners = { brandText: string; welcomeText: string; flags: FlagCode[] };
export const BANNER_TEXT_LIMIT = 80;
export const DEFAULT_ACCESS_BANNERS: AccessBanners = { brandText: "BDG", welcomeText: "Bienvenue", flags: ["MA"] };

const countries = new Intl.DisplayNames("fr", { type: "region" });
export function flagName(code: FlagCode) { return countries.of(code) ?? code; }
export function isFlagCode(value: unknown): value is FlagCode {
  return FLAG_CODES.some(code => code === value);
}
