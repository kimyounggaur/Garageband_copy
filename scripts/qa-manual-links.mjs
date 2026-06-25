import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const transportBarPath = join(root, "src", "components", "transport", "TransportBar.tsx");
const transportBar = readFileSync(transportBarPath, "utf8");

const checks = [
  {
    label: "header includes user manual link",
    ok: transportBar.includes("./manual/user/garageband-user-manual.html") && transportBar.includes("유저 메뉴얼")
  },
  {
    label: "header includes quickstart manual link",
    ok:
      transportBar.includes("./manual/quickstart/garageband-quickstart-user-manual.html") &&
      transportBar.includes("퀵스타트")
  },
  {
    label: "user manual html is published",
    ok: existsSync(join(root, "public", "manual", "user", "garageband-user-manual.html"))
  },
  {
    label: "quickstart manual html is published",
    ok: existsSync(join(root, "public", "manual", "quickstart", "garageband-quickstart-user-manual.html"))
  },
  {
    label: "manual screenshot asset is published for both manuals",
    ok:
      existsSync(join(root, "public", "manual", "user", "assets", "app-overview.png")) &&
      existsSync(join(root, "public", "manual", "quickstart", "assets", "app-overview.png"))
  },
  {
    label: "github pages docs include both manuals",
    ok:
      existsSync(join(root, "docs", "manual", "user", "garageband-user-manual.html")) &&
      existsSync(join(root, "docs", "manual", "quickstart", "garageband-quickstart-user-manual.html"))
  },
  {
    label: "github pages docs include manual screenshot assets",
    ok:
      existsSync(join(root, "docs", "manual", "user", "assets", "app-overview.png")) &&
      existsSync(join(root, "docs", "manual", "quickstart", "assets", "app-overview.png"))
  }
];

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failed.length > 0) {
  process.exit(1);
}
