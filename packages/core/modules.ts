import type { CliCommandRegistry } from "./cli";
import type { DomainFeature, EnabledFeatures, ProviderFeature } from "./features";
import type { Logger } from "./logging";
import type { AppPaths } from "./paths";

export interface ApplicationContext {
  readonly features: EnabledFeatures;
  readonly paths: AppPaths;
  readonly logger: Logger;
}

export interface ModuleRegistrationContext extends ApplicationContext {
  readonly cli: CliCommandRegistry;
}

export interface DomainModule {
  readonly id: DomainFeature;
  readonly displayName: string;
  readonly providerFeatures: readonly ProviderFeature[];
  register(context: ModuleRegistrationContext): void;
}
