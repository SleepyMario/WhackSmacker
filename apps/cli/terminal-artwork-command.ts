import { defaultSettingsDirectoryForContentDataDirectory, loadSourceLanguageSettings, saveTerminalArtworkBackend } from "../../src/settings/source-language";
import { isTerminalArtworkBackend, terminalArtworkBackendLabels, terminalArtworkBackendValues } from "../../packages/core/terminal-artwork-settings";
import {
  detectTerminalArtwork,
  formatTerminalArtworkDiagnostics,
  type TerminalArtworkEnvironment,
  type TerminalArtworkRectangle
} from "./terminal-artwork";

let activeCentrePaneRectangle: TerminalArtworkRectangle | undefined;

export function setActiveTerminalArtworkRectangle(rectangle: TerminalArtworkRectangle | undefined): void {
  activeCentrePaneRectangle = rectangle;
}

export async function runTerminalArtworkCommand(
  args: readonly string[],
  options: { readonly dataDir?: string; readonly settingsDir?: string; readonly env?: TerminalArtworkEnvironment } = {}
): Promise<string> {
  const settingsDir = options.settingsDir ?? (options.dataDir === undefined ? undefined : defaultSettingsDirectoryForContentDataDirectory(options.dataDir));
  const [command, value, ...extra] = args;
  if (command === "diagnostics" && value === undefined) {
    const configured = (await loadSourceLanguageSettings(settingsDir)).terminalArtworkBackend;
    return formatTerminalArtworkDiagnostics(await detectTerminalArtwork(configured, options.env), activeCentrePaneRectangle);
  }
  if (command === "backend" && value !== undefined && extra.length === 0) {
    if (!isTerminalArtworkBackend(value)) {
      throw new Error(`Terminal artwork backend must be one of: ${terminalArtworkBackendValues.join(", ")}.`);
    }
    await saveTerminalArtworkBackend(value, settingsDir);
    return `Terminal artwork backend: ${terminalArtworkBackendLabels[value]}`;
  }
  throw new Error("Usage: whacksmacker artwork diagnostics | whacksmacker artwork backend <auto|wayland-overlay|x11-overlay|kitty|sixel|iterm2|disabled>");
}
