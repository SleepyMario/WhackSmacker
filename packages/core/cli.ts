export interface CliCommand {
  readonly path: readonly string[];
  readonly summary: string;
  run(args: readonly string[]): Promise<void>;
}

export interface CliCommandRegistry {
  register(command: CliCommand): void;
}

export class InMemoryCliCommandRegistry implements CliCommandRegistry {
  private readonly commands: CliCommand[] = [];

  register(command: CliCommand): void {
    this.commands.push(command);
  }

  list(): readonly CliCommand[] {
    return [...this.commands];
  }

  find(path: readonly string[]): CliCommand | null {
    return this.commands.find((command) => samePath(command.path, path)) ?? null;
  }
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}
