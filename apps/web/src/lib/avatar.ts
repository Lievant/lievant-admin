// Escala neutra: el sistema es monocromático, así que los avatares se
// distinguen por tono de gris en lugar de por color. Todos los tonos tienen
// contraste suficiente para iniciales en blanco.
const AVATAR_COLORS = ['#18181b', '#27272a', '#3f3f46', '#52525b', '#404040', '#262626', '#71717a'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#27272a';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
