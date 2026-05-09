import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempRoot = join(tmpdir(), `webband-studio-build-${process.pid}`);
const filesToCopy = [
  "index.html",
  "package.json",
  "package-lock.json",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "public",
  "src"
];

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyRecursive(source, destination) {
  const stats = statSync(source);
  if (stats.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source)) {
      copyRecursive(join(source, entry), join(destination, entry));
    }
    return;
  }
  copyFileSync(source, destination);
}

function copyProject() {
  console.log(`> prepare ${tempRoot}`);
  try {
    rmSync(tempRoot, { recursive: true, force: true });
    mkdirSync(tempRoot, { recursive: true });

    for (const item of filesToCopy) {
      const source = join(root, item);
      if (existsSync(source)) {
        console.log(`  copy ${item}`);
        copyRecursive(source, join(tempRoot, basename(item)));
      }
    }

    console.log("  link node_modules");
    symlinkSync(join(root, "node_modules"), join(tempRoot, "node_modules"), "junction");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function mirrorDist() {
  const result = spawnSync(
    "robocopy",
    [join(tempRoot, "dist"), join(root, "dist"), "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS"],
    { stdio: "inherit" }
  );
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if ((result.status ?? 16) > 7) {
    process.exit(result.status ?? 1);
  }
}

try {
  run(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-b"], root);
  copyProject();
  run(process.execPath, [join(tempRoot, "node_modules", "vite", "bin", "vite.js"), "build", "--base", "./"], tempRoot);
  console.log("> copy dist");
  mirrorDist();
  console.log("> build complete");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
