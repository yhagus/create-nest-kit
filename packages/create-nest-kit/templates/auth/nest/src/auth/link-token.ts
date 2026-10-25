/**
 * The `?token=` of a link `@nestjs/authentication` built. Our mails build their own link from
 * it, the same as in every auth style.
 */
export function tokenOf(link: { url: string }): string {
  const token = new URL(link.url).searchParams.get('token');
  if (token === null) throw new Error('The link has no token');
  return token;
}
