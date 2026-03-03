import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT_ROOT = process.cwd();

function resolveAlias(specifier) {
  if (specifier === "next/server") {
    return path.join(PROJECT_ROOT, "node_modules", "next", "server.js");
  }

  if (specifier === "@/auth") {
    return path.join(PROJECT_ROOT, "auth.ts");
  }

  if (!specifier.startsWith("@/")) {
    return null;
  }

  const withoutAlias = specifier.slice(2);
  const basePath = path.join(PROJECT_ROOT, "src", withoutAlias);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export async function resolve(specifier, context, defaultResolve) {
  const resolvedPath = resolveAlias(specifier);
  if (resolvedPath) {
    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedPath).href,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
