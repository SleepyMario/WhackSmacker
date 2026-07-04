declare const process: {
  env: Record<string, string | undefined>;
};

export interface AppPaths {
  readonly dataHome: string;
  readonly profileDatabase: string;
  domainDatabase(domain: string): string;
}

export function createDefaultAppPaths(appName = "whacksmacker"): AppPaths {
  const dataHome = `${process.env.XDG_DATA_HOME ?? `${process.env.HOME ?? "."}/.local/share`}/${appName}`;

  return {
    dataHome,
    profileDatabase: `${dataHome}/profile.sqlite`,
    domainDatabase(domain) {
      return `${dataHome}/${domain}.sqlite`;
    }
  };
}
