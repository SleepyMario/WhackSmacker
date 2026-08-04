export const terminalArtworkBackendValues = [
  "auto",
  "wayland-overlay",
  "x11-overlay",
  "kitty",
  "sixel",
  "iterm2",
  "disabled"
] as const;

export type TerminalArtworkBackend = (typeof terminalArtworkBackendValues)[number];

export const terminalArtworkBackendLabels: Readonly<Record<TerminalArtworkBackend, string>> = {
  auto: "Auto",
  "wayland-overlay": "Wayland overlay",
  "x11-overlay": "X11 overlay",
  kitty: "Kitty",
  sixel: "Sixel",
  iterm2: "iTerm2",
  disabled: "Disabled"
};

export function isTerminalArtworkBackend(value: unknown): value is TerminalArtworkBackend {
  return typeof value === "string" && terminalArtworkBackendValues.includes(value as TerminalArtworkBackend);
}

export function nextTerminalArtworkBackend(value: TerminalArtworkBackend): TerminalArtworkBackend {
  const index = terminalArtworkBackendValues.indexOf(value);
  return terminalArtworkBackendValues[(index + 1) % terminalArtworkBackendValues.length] ?? "auto";
}
