import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await Promise.all([
  writeFile("dist/main.js", "#!/usr/bin/env node\nrequire(\"./apps/cli/main\").main();\n"),
  writeFile("dist/anki-client.js", "module.exports = require(\"./packages/language/anki-client\");\n")
]);
