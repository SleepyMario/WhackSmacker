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

export type FirstClassModuleCategory = "Languages" | "Games" | "Geography" | "Mathematics";

export type FirstClassModuleSourceKind =
  | "content-package"
  | "native-module"
  | "built-in-module"
  | "future-downloadable-module";

export type FirstClassModuleActionKind = "command" | "message";

export interface FirstClassModuleAction {
  readonly id: string;
  readonly label: string;
  readonly kind: FirstClassModuleActionKind;
  readonly commandPath?: readonly string[];
  readonly commandArgs?: readonly string[];
  readonly launchTitle?: string;
  readonly previewText?: string;
}

export interface FirstClassModuleDescriptor {
  readonly moduleId: string;
  readonly displayName: string;
  readonly category: FirstClassModuleCategory;
  readonly version: string;
  readonly sourceKind: FirstClassModuleSourceKind;
  readonly packageId?: string;
  readonly packageVersion?: string;
  readonly description: string;
  readonly readableContentCount?: number;
  readonly reviewSourceCount?: number;
  readonly actions?: readonly FirstClassModuleAction[];
}

export interface InstalledPackageModuleInput {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly displayName: string;
}

export const firstClassModuleCategoryOrder: readonly FirstClassModuleCategory[] = [
  "Languages",
  "Games",
  "Geography",
  "Mathematics"
];

export function getBuiltInFirstClassModules(): readonly FirstClassModuleDescriptor[] {
  return [
    {
      moduleId: "com.sleepymario.game.chess",
      displayName: "Chess",
      category: "Games",
      version: "0.1.0",
      sourceKind: "native-module",
      description: "Terminal chessboard module with board display, move application, and legal-move lookup.",
      actions: [
        {
          id: "board",
          label: "Play / Board",
          kind: "command",
          commandPath: ["chess"],
          commandArgs: [],
          launchTitle: "Chess",
          previewText: "Play / Board\n\nPress Enter to launch the existing terminal chessboard flow.\n\nEquivalent command:\nwhacksmacker chess"
        },
        {
          id: "legal",
          label: "Legal moves",
          kind: "message",
          previewText: "Legal moves\n\nUse the command form for now:\nwhacksmacker chess --legal e2\n\nThis tree node is guidance only until a square prompt exists."
        },
        {
          id: "info",
          label: "Module info",
          kind: "message",
          previewText: "Chess\n\nBuilt-in terminal chess module.\nUser state is not stored in installed content packages."
        }
      ]
    },
    {
      moduleId: "com.sleepymario.geography",
      displayName: "Continents",
      category: "Geography",
      version: "0.1.0",
      sourceKind: "built-in-module",
      description: "Built-in six-continent terminal map review using bundled geography data and provenance.",
      actions: [
        {
          id: "continents",
          label: "Continents",
          kind: "command",
          commandPath: ["geography", "continents"],
          commandArgs: [],
          launchTitle: "Geography -- Continents",
          previewText: "Continents\n\nPress Enter to launch the existing six-continent terminal map review.\n\nEquivalent command:\nwhacksmacker geography continents"
        }
      ]
    },
    {
      moduleId: "com.sleepymario.mathematics",
      displayName: "Beginner Mathematics",
      category: "Mathematics",
      version: "0.1.0",
      sourceKind: "built-in-module",
      description: "Built-in beginner mathematics workbook generators. These are not installed content packages yet.",
      actions: [
        {
          id: "volume-one",
          label: "Generate complete Volume 1",
          kind: "message",
          previewText: "Generate complete Volume 1\n\nUse the command form for now:\nwhacksmacker mathematics beginner-volume-one --output ./beginner-mathematics-volume-one.pdf\n\nThe tree keeps this as guidance to avoid opening an output-path prompt inside the pane."
        },
        {
          id: "unit-1",
          label: "Generate Unit 1 - One, Two, Three",
          kind: "message",
          previewText: "Generate Unit 1 - One, Two, Three\n\nUse the command form for now:\nwhacksmacker mathematics one-two-three --output ./one-two-three-workbook.pdf"
        },
        {
          id: "unit-2",
          label: "Generate Unit 2 - Four and Five",
          kind: "message",
          previewText: "Generate Unit 2 - Four and Five\n\nUse the command form for now:\nwhacksmacker mathematics four-and-five --output ./four-and-five-workbook.pdf"
        },
        {
          id: "unit-3",
          label: "Generate Unit 3 - One to Five",
          kind: "message",
          previewText: "Generate Unit 3 - One to Five\n\nUse the command form for now:\nwhacksmacker mathematics one-to-five --output ./one-to-five-workbook.pdf"
        },
        {
          id: "unit-4",
          label: "Generate Unit 4 - Six, Seven, Eight, Nine",
          kind: "message",
          previewText: "Generate Unit 4 - Six, Seven, Eight, Nine\n\nUse the command form for now:\nwhacksmacker mathematics six-to-nine --output ./six-to-nine-workbook.pdf"
        }
      ]
    }
  ];
}

export function isLanguageLikeModulePackage(packageId: string): boolean {
  return packageId.startsWith("com.sleepymario.language.");
}

export function displayLabelForModulePackage(displayName: string): string {
  return displayName.replace(/\s+Curriculum$/u, "");
}

export function installedPackageToFirstClassModuleDescriptor(
  contentPackage: InstalledPackageModuleInput,
  counts: { readonly readableContentCount?: number; readonly reviewSourceCount?: number } = {}
): FirstClassModuleDescriptor | null {
  if (!isLanguageLikeModulePackage(contentPackage.packageId)) {
    return null;
  }

  return {
    moduleId: contentPackage.packageId,
    displayName: displayLabelForModulePackage(contentPackage.displayName),
    category: "Languages",
    version: contentPackage.packageVersion,
    sourceKind: "content-package",
    packageId: contentPackage.packageId,
    packageVersion: contentPackage.packageVersion,
    description: "Installed read-only language content package.",
    readableContentCount: counts.readableContentCount,
    reviewSourceCount: counts.reviewSourceCount
  };
}

export function sortFirstClassModules(
  descriptors: readonly FirstClassModuleDescriptor[]
): readonly FirstClassModuleDescriptor[] {
  return [...descriptors].sort((left, right) => {
    const categoryDelta = firstClassModuleCategoryOrder.indexOf(left.category) - firstClassModuleCategoryOrder.indexOf(right.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

export function formatFirstClassModuleInfo(descriptor: FirstClassModuleDescriptor): string {
  const lines = [
    descriptor.displayName,
    "",
    `Module ID: ${descriptor.moduleId}`,
    `Category: ${descriptor.category}`,
    `Version: ${descriptor.version}`,
    `Source kind: ${descriptor.sourceKind}`,
    descriptor.packageId === undefined ? "" : `Package: ${descriptor.packageId}`,
    descriptor.packageVersion === undefined ? "" : `Package version: ${descriptor.packageVersion}`,
    descriptor.readableContentCount === undefined ? "" : `Readable content entries: ${descriptor.readableContentCount}`,
    descriptor.reviewSourceCount === undefined ? "" : `Review sources: ${descriptor.reviewSourceCount}`,
    "",
    descriptor.description
  ].filter((line) => line.length > 0);

  if ((descriptor.actions?.length ?? 0) > 0) {
    lines.push("", "Actions:");
    for (const action of descriptor.actions ?? []) {
      const command = action.commandPath === undefined ? "" : ` (whacksmacker ${action.commandPath.join(" ")})`;
      lines.push(`- ${action.label}${command}`);
    }
  }

  return lines.join("\n");
}

export function findFirstClassModule(
  descriptors: readonly FirstClassModuleDescriptor[],
  moduleId: string
): FirstClassModuleDescriptor | undefined {
  return descriptors.find((descriptor) => descriptor.moduleId === moduleId);
}
