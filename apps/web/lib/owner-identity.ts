// Pure authorization decision. Provider identity comes from Supabase getUser(),
// never from user-editable profile metadata or client-provided parameters.
export type ProviderIdentity = {
  provider: string;
  identity_data?: Record<string, unknown> | null;
};

export function hasOwnerGitHubIdentity(
  identities: readonly ProviderIdentity[] | null | undefined,
  expectedGitHubId: string | undefined
): boolean {
  if (!expectedGitHubId || !/^[1-9]\d*$/.test(expectedGitHubId)) return false;
  return identities?.some((identity) => {
    if (identity.provider !== 'github') return false;
    const id = identity.identity_data?.provider_id ?? identity.identity_data?.sub;
    if (typeof id === 'number') {
      return Number.isSafeInteger(id) && id > 0 && String(id) === expectedGitHubId;
    }
    return typeof id === 'string' && /^[1-9]\d*$/.test(id) && id === expectedGitHubId;
  }) ?? false;
}
