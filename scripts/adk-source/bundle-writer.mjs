import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function writeBundleFiles(outputRoot, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(outputRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
}
