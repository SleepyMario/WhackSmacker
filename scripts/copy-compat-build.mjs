import { chmod, cp, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await writeFile("dist/main.js", "#!/usr/bin/env node\nrequire(\"./apps/cli/main\").main();\n");
await chmod("dist/main.js", 0o755);
await cp("apps/web/public", "dist/apps/web/public", { recursive: true });
