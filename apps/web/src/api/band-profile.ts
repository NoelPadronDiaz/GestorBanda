import { apiFetch } from './client';
import type { BandProfile } from './types';

export const bandProfileKey = ['band-profile'] as const;

export function getBandProfile(signal?: AbortSignal): Promise<BandProfile> {
  return apiFetch<BandProfile>('/band-profile', { signal });
}

export type BandProfileInput = Partial<Omit<BandProfile, 'updated_at'>>;

export function updateBandProfile(body: BandProfileInput): Promise<BandProfile> {
  return apiFetch<BandProfile>('/band-profile', { method: 'PATCH', body });
}
