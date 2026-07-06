export type DomainFeature = "language" | "chess" | "geography" | "mathematics" | "content";

export type ProviderFeature = "anki" | "lichess" | "stockfish" | "syzygy";

export type SurfaceFeature = "cli" | "desktop";

export type WhackSmackerFeature = DomainFeature | ProviderFeature | SurfaceFeature;

export interface EnabledFeatures {
  readonly domains: ReadonlySet<DomainFeature>;
  readonly providers: ReadonlySet<ProviderFeature>;
  readonly surfaces: ReadonlySet<SurfaceFeature>;
}

export function createEnabledFeatures(features: Iterable<WhackSmackerFeature>): EnabledFeatures {
  const domains = new Set<DomainFeature>();
  const providers = new Set<ProviderFeature>();
  const surfaces = new Set<SurfaceFeature>();

  for (const feature of features) {
    if (isDomainFeature(feature)) {
      domains.add(feature);
    } else if (isProviderFeature(feature)) {
      providers.add(feature);
    } else {
      surfaces.add(feature);
    }
  }

  return { domains, providers, surfaces };
}

export function isDomainFeature(feature: WhackSmackerFeature): feature is DomainFeature {
  return feature === "language" || feature === "chess" || feature === "geography" || feature === "mathematics" || feature === "content";
}

export function isProviderFeature(feature: WhackSmackerFeature): feature is ProviderFeature {
  return feature === "anki" || feature === "lichess" || feature === "stockfish" || feature === "syzygy";
}
