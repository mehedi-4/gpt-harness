import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../android/", import.meta.url));
const signed = existsSync(new URL("../.local/android-signing/signing.properties", import.meta.url));
const variant = signed ? "Release" : "Debug";
const result = spawnSync(process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  ["testDebugUnitTest", `lint${variant}`, `assemble${variant}`], { cwd: project, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
const output = new URL("../artifacts/", import.meta.url);
mkdirSync(output, { recursive: true });
const name = signed ? "gpt-harness-android.apk" : "gpt-harness-android-debug.apk";
copyFileSync(`${project}/app/build/outputs/apk/${variant.toLowerCase()}/app-${variant.toLowerCase()}.apk`, new URL(name, output));
console.log(`APK: ${fileURLToPath(new URL(name, output))}`);
