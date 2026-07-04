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

export class DomainModuleRegistry {
  private readonly modules = new Map<DomainFeature, DomainModule>();

  register(module: DomainModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Domain module is already registered: ${module.id}`);
    }

    this.modules.set(module.id, module);
  }

  list(): readonly DomainModule[] {
    return [...this.modules.values()];
  }
}
