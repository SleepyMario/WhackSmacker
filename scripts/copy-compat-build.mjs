import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await writeFile("dist/main.js", "#!/usr/bin/env node\nrequire(\"./apps/cli/main\").main();\n");
