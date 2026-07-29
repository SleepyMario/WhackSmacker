const generations = new Map<string, number>();

export function installedContentGeneration(dataDirectory: string): number {
  return generations.get(dataDirectory) ?? 0;
}

export function invalidateInstalledContent(dataDirectory: string): void {
  generations.set(dataDirectory, installedContentGeneration(dataDirectory) + 1);
}
