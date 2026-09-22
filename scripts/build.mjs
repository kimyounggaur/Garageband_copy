import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempRoot = join(tmpdir(), `webband-studio-build-${process.pid}`);

function assertWithin(target, parent, label) {
  const absoluteTarget = resolve(target);
  const absoluteParent = resolve(parent);
  const pathFromParent = relative(absoluteParent, absoluteTarget);
  if (!pathFromParent || isAbsolute(pathFromParent) || pathFromParent.startsWith("..") || resolve(absoluteParent, pathFromParent) !== absoluteTarget) {
    throw new Error(`Unsafe ${label} path: ${absoluteTarget}`);
  }
  return absoluteTarget;
}

function verifiedTempRoot() {
  const target = assertWithin(tempRoot, tmpdir(), "temporary build");
  if (basename(target) !== `webband-studio-build-${process.pid}`) throw new Error("Unexpected temporary build name");
  return target;
}
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
    rmSync(verifiedTempRoot(), { recursive: true, force: true });
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
  const source = assertWithin(join(tempRoot, "dist"), verifiedTempRoot(), "build source");
  const destination = assertWithin(join(root, "dist"), root, "build destination");
  const result = spawnSync(
    "robocopy",
    [source, destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS"],
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

function syncPagesDocs(distRoot = join(root, "dist")) {
  const docsRoot = join(root, "docs");
  console.log("> sync docs");
  mkdirSync(docsRoot, { recursive: true });
  copyFileSync(join(distRoot, "index.html"), join(docsRoot, "index.html"));
  const assetsRoot = join(docsRoot, "assets");
  rmSync(assertWithin(assetsRoot, root, "docs assets"), { recursive: true, force: true });
  mkdirSync(assetsRoot, { recursive: true });
  copyRecursive(join(distRoot, "assets"), assetsRoot);
  for (const publicFile of ["manifest.webmanifest", "sw.js"]) {
    copyFileSync(join(distRoot, publicFile), join(docsRoot, publicFile));
  }
  for (const publicDirectory of ["samples", "manual", "icons", "og"]) {
    if (existsSync(join(distRoot, publicDirectory))) {
      copyRecursive(join(distRoot, publicDirectory), join(docsRoot, publicDirectory));
    }
  }
  writeFileSync(join(docsRoot, ".nojekyll"), "");
  console.log("> docs synced");
}

try {
  run(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-b"], root);
  if (process.platform !== "win32") {
    run(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build", "--base", "./"], root);
    run(process.execPath, [join(root, "scripts", "generate-pwa.mjs"), join(root, "dist")], root);
    syncPagesDocs();
    process.exit(0);
  }

  copyProject();
  run(process.execPath, [join(tempRoot, "node_modules", "vite", "bin", "vite.js"), "build", "--base", "./"], tempRoot);
  run(process.execPath, [join(root, "scripts", "generate-pwa.mjs"), join(tempRoot, "dist")], root);
  console.log("> copy dist");
  mirrorDist();
  syncPagesDocs(join(tempRoot, "dist"));
  console.log("> build complete");
  process.exitCode = 0;
} finally {
  rmSync(verifiedTempRoot(), { recursive: true, force: true });
}
