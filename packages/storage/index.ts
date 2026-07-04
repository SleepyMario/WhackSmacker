import type { AppPaths } from "../core";

export interface DomainStorageLocation {
  readonly domain: string;
  readonly databasePath: string;
}

export function getDomainStorageLocation(paths: AppPaths, domain: string): DomainStorageLocation {
  return {
    domain,
    databasePath: paths.domainDatabase(domain)
  };
}
