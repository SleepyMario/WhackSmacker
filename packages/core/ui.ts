export interface NavigationItem {
  readonly id: string;
  readonly label: string;
}

export interface SurfaceDescriptor {
  readonly id: string;
  readonly label: string;
  readonly navigationItems: readonly NavigationItem[];
}
