import type { Permission } from '@alcaravan/shared';

export interface Me {
  id: string;
  email: string;
  member_id: string | null;
  roles: string[];
  permissions: Permission[];
  last_login_at: string | null;
}

/** Respuesta de login y refresh. El refresh token viaja solo en cookie httpOnly. */
export interface Session {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: Me;
}

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'LEFT';

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  status: MemberStatus;
  joined_on: string | null;
  left_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; page_size: number; total: number };
}

export interface BandProfile {
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  default_currency: string;
  timezone: string;
  founded_on: string | null;
  iban: string | null;
  invoice_footer: string | null;
  updated_at: string;
}
