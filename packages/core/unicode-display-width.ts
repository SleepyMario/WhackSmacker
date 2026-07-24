const ansiSequence = /\x1b\[[0-?]*[ -/]*[@-~]/gu;

export function stripAnsiForDisplay(value: string): string {
  return value.replace(ansiSequence, "");
}

export function unicodeTerminalDisplayWidth(value: string): number {
  let width = 0;
  for (const character of [...stripAnsiForDisplay(value)]) {
    if (/\p{Mark}/u.test(character) || character === "\u200d" || /[\uFE00-\uFE0F]/u.test(character)) continue;
    width += isUnicodeWideCharacter(character) ? 2 : 1;
  }
  return width;
}

export function isUnicodeWideCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return (codePoint >= 0x1100 && codePoint <= 0x11ff)
    || (codePoint >= 0x2329 && codePoint <= 0x232a)
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x1f300 && codePoint <= 0x1faff)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd);
}
