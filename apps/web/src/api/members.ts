import { apiFetch } from './client';
import type { Member, MemberStatus, Paginated } from './types';

export interface ListMembersParams {
  page: number;
  page_size: number;
  q?: string;
  status?: MemberStatus;
}

export const membersKeys = {
  all: ['members'] as const,
  list: (params: ListMembersParams) => ['members', 'list', params] as const,
};

export function listMembers(
  params: ListMembersParams,
  signal?: AbortSignal,
): Promise<Paginated<Member>> {
  return apiFetch<Paginated<Member>>('/members', { query: { ...params }, signal });
}
