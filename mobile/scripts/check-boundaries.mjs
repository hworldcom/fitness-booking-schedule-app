import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const extensions = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  "/index.ts",
  "/index.tsx",
  "/index.js",
];
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/;
const forbidden =
  /^(?:next|server-only|postgres|pg|drizzle-orm|react-dom|@supabase\/ssr)(?:\/|$)/;
const within = (file, directory) =>
  file === directory || file.startsWith(directory + path.sep);

export function importSpecifiers(file, content) {
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const imports = [];
  const add = (node, specifier) =>
    imports.push({
      specifier,
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    });
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      add(
        node,
        ts.isStringLiteralLike(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : null,
      );
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      add(
        node,
        node.moduleReference.expression &&
          ts.isStringLiteralLike(node.moduleReference.expression)
          ? node.moduleReference.expression.text
          : null,
      );
    else if (ts.isImportTypeNode(node))
      add(
        node,
        ts.isLiteralTypeNode(node.argument) &&
          ts.isStringLiteralLike(node.argument.literal)
          ? node.argument.literal.text
          : null,
      );
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    )
      add(
        node,
        node.arguments.length && ts.isStringLiteralLike(node.arguments[0])
          ? node.arguments[0].text
          : null,
      );
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return imports;
}

export function inspectProject(project) {
  const root = fs.realpathSync(project);
  const source = path.join(root, "src");
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const config = ts.readConfigFile(
    path.join(root, "tsconfig.json"),
    ts.sys.readFile,
  );
  const errors = [];
  const dependencies = new Set(Object.keys(pkg.dependencies ?? {}));
  if (config.error || config.config.extends !== "expo/tsconfig.base")
    errors.push("Mobile must extend only its own Expo base configuration.");
  if (
    JSON.stringify(config.config?.compilerOptions?.paths ?? {}) !==
    JSON.stringify({ "@/*": ["./src/*"] })
  )
    errors.push("Mobile aliases must resolve only to the mobile src tree.");
  // react-dom is declared only for the RN web QA renderer; native source
  // cannot import it, and the separate iOS bundle audit rejects it.
  for (const name of dependencies)
    if (name !== "react-dom" && forbidden.test(name))
      errors.push("Forbidden native dependency: " + name);
  let count = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const real = fs.realpathSync(file);
      if (!within(real, source)) {
        errors.push("Source symlink escapes the app: " + file);
        continue;
      }
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!sourceExtension.test(file)) continue;
      count += 1;
      for (const edge of importSpecifiers(
        file,
        fs.readFileSync(file, "utf8"),
      )) {
        const location = path.relative(root, file) + ":" + edge.line;
        if (edge.specifier === null) {
          errors.push(location + " non-literal module load");
          continue;
        }
        const name = edge.specifier;
        const local = name.startsWith("@/")
          ? path.join(source, name.slice(2))
          : name.startsWith(".")
            ? path.resolve(path.dirname(file), name)
            : null;
        if (local) {
          const resolved = extensions
            .map((suffix) => local + suffix)
            .find(
              (candidate) =>
                fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
            );
          if (!resolved) {
            errors.push(location + " unresolved local import " + name);
            continue;
          }
          const target = fs.realpathSync(resolved);
          if (
            !within(target, source) &&
            !within(target, path.join(root, "assets"))
          )
            errors.push(
              location + " import escapes mobile source/assets: " + name,
            );
        } else {
          const parts = name.split("/");
          const packageName = name.startsWith("@")
            ? parts.slice(0, 2).join("/")
            : parts[0];
          if (forbidden.test(name) || !dependencies.has(packageName))
            errors.push(
              location + " forbidden or undeclared native dependency: " + name,
            );
        }
      }
    }
  }
  if (fs.existsSync(source)) walk(source);
  else errors.push("Mobile src directory is missing.");
  return { files: count, errors };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = inspectProject(
    path.resolve(fileURLToPath(new URL("..", import.meta.url))),
  );
  if (result.errors.length) {
    process.stderr.write(result.errors.join("\n") + "\n");
    process.exitCode = 1;
  } else
    process.stdout.write(
      "Mobile import boundaries passed (" + result.files + " source files).\n",
    );
}
