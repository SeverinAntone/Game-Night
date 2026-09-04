/**
 * Avatar options for player profiles. Grouped so the picker reads as a small
 * cast of characters rather than a wall of emoji.
 */

export const AVATAR_GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Table",
    emoji: ["🎲", "🃏", "♟️", "🎯", "🀄", "🎴", "🧩", "⏳", "🏆", "🪙", "📯", "🗺️"],
  },
  {
    label: "Fantasy",
    emoji: ["🧙", "🧝", "🧚", "🧌", "🐉", "🦄", "🗡️", "🛡️", "🏰", "👑", "🔮", "⚗️"],
  },
  {
    label: "Rogues",
    emoji: ["🥷", "🏴‍☠️", "💀", "👻", "👺", "🤖", "👽", "🎃", "🕵️", "🦹", "🧟", "🪄"],
  },
  {
    label: "Creatures",
    emoji: ["🦊", "🐙", "🦉", "🦖", "🐝", "🐺", "🦅", "🐸", "🦌", "🐢", "🦩", "🐌"],
  },
  {
    label: "Nonsense",
    emoji: ["🥔", "🌵", "🍄", "🫖", "🧀", "🚀", "🌶️", "🧊", "🪴", "🎩", "🦴", "☕"],
  },
];

export const AVATAR_EMOJI = AVATAR_GROUPS.flatMap((g) => g.emoji);

export const AVATAR_COLORS = [
  "#8b5cf6", // grape
  "#a78bfa", // lilac
  "#f0abfc", // orchid
  "#fb7185", // rose
  "#fb923c", // ember
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // mint
  "#2dd4bf", // teal
  "#38bdf8", // sky
  "#818cf8", // indigo
  "#e2e8f0", // bone
];

export const randomAvatar = () => ({
  emoji: AVATAR_EMOJI[Math.floor(Math.random() * AVATAR_EMOJI.length)],
  color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
});
