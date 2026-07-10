import { cp, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await writeFile("dist/main.js", "#!/usr/bin/env node\nrequire(\"./apps/cli/main\").main();\n");
await cp("apps/web/public", "dist/apps/web/public", { recursive: true });
