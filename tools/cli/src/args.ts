export interface ParsedArgs {
  command: string | null;
  positionals: string[];
  flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] as string;
    if (argument === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (argument.startsWith('--')) {
      const body = argument.slice(2);
      const equalsIndex = body.indexOf('=');
      if (equalsIndex >= 0) {
        flags[body.slice(0, equalsIndex)] = body.slice(equalsIndex + 1);
        continue;
      }

      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[body] = next;
        index += 1;
      } else {
        flags[body] = 'true';
      }
      continue;
    }

    positionals.push(argument);
  }

  return {
    command: positionals.shift() ?? null,
    positionals,
    flags,
  };
}
