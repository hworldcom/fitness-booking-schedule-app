import path from "node:path";
import ts from "typescript";

export type ImportKind = "runtime" | "type";
export type SourceImport = Readonly<{
  specifier: string | null;
  kind: ImportKind;
  syntax:
    | "import"
    | "export"
    | "import-type"
    | "import-equals"
    | "dynamic"
    | "require";
  line: number;
  target?: string;
  external: boolean;
  asset: boolean;
}>;
export type SourceModule = Readonly<{
  file: string;
  client: boolean;
  serverAction: boolean;
  serverOnly: boolean;
  imports: readonly SourceImport[];
}>;
export type DependencyGraph = ReadonlyMap<string, SourceModule>;

const extensions = [
  ".ts",
  ".tsx",
  ".d.ts",
  ".mts",
  ".d.mts",
  ".cts",
  ".d.cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];
export const sourcePath = (file: string) =>
  path.posix.normalize(file.replaceAll("\\", "/"));
export const within = (file: string, directory: string) =>
  file === directory || file.startsWith(`${directory}/`);

function importBase(file: string, specifier: string) {
  if (specifier.startsWith("@/"))
    return sourcePath(`src/${specifier.slice(2)}`);
  if (specifier.startsWith("."))
    return sourcePath(path.posix.join(path.posix.dirname(file), specifier));
  return undefined;
}

/** Resolve the repository's @/ alias, relative code, index barrels and JS-to-TS imports. */
export function resolveSourceImport(
  file: string,
  specifier: string,
  files: ReadonlySet<string>,
) {
  const base = importBase(file, specifier);
  if (!base) return undefined;
  const substitution: Record<string, readonly string[]> = {
    ".js": [".ts", ".tsx", ".d.ts"],
    ".jsx": [".tsx"],
    ".mjs": [".mts", ".d.mts"],
    ".cjs": [".cts", ".d.cts"],
  };
  const extension = path.posix.extname(base);
  const replacements = (substitution[extension] ?? []).map(
    (next) => base.slice(0, -extension.length) + next,
  );
  return [
    ...replacements,
    base,
    ...extensions.map((ext) => base + ext),
    ...extensions.map((ext) => `${base}/index${ext}`),
  ].find((candidate) => files.has(candidate));
}

function readModule(file: string, text: string): SourceModule {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const directives = new Set<string>();
  for (const statement of source.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      break;
    directives.add(statement.expression.text);
  }
  const imports: SourceImport[] = [];
  function add(
    node: ts.Node,
    specifier: string | null,
    kind: ImportKind,
    syntax: SourceImport["syntax"],
  ) {
    const base = specifier === null ? undefined : importBase(file, specifier);
    const extension = specifier === null ? "" : path.posix.extname(specifier);
    imports.push({
      specifier,
      kind,
      syntax,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      external: specifier !== null && base === undefined,
      asset: Boolean(base && extension && !extensions.includes(extension)),
    });
  }
  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly ||
        (!clause?.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly));
      add(
        node,
        node.moduleSpecifier.text,
        typeOnly ? "type" : "runtime",
        "import",
      );
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (clause &&
          ts.isNamedExports(clause) &&
          clause.elements.length > 0 &&
          clause.elements.every((item) => item.isTypeOnly));
      add(
        node,
        node.moduleSpecifier.text,
        typeOnly ? "type" : "runtime",
        "export",
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const value = node.moduleReference.expression;
      add(
        node,
        value && ts.isStringLiteralLike(value) ? value.text : null,
        node.isTypeOnly ? "type" : "runtime",
        "import-equals",
      );
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      add(node, node.argument.literal.text, "type", "import-type");
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const value = node.arguments[0];
      add(
        node,
        value && ts.isStringLiteralLike(value) ? value.text : null,
        "runtime",
        node.expression.kind === ts.SyntaxKind.ImportKeyword
          ? "dynamic"
          : "require",
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return {
    file,
    client: directives.has("use client"),
    serverAction: directives.has("use server"),
    serverOnly: imports.some(
      (item) => item.specifier === "server-only" && item.kind === "runtime",
    ),
    imports,
  };
}

/** Pure input maps make regression fixtures independent of the application's filesystem/data. */
export function createDependencyGraph(
  sources: Readonly<Record<string, string>>,
): DependencyGraph {
  const modules = new Map<string, SourceModule>();
  for (const [name, text] of Object.entries(sources).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const file = sourcePath(name);
    if (modules.has(file))
      throw new Error(`Duplicate normalized source path: ${file}`);
    modules.set(file, readModule(file, text));
  }
  const files = new Set(modules.keys());
  for (const [file, module] of modules) {
    modules.set(file, {
      ...module,
      imports: module.imports.map((item) => {
        const target =
          item.specifier === null
            ? undefined
            : resolveSourceImport(file, item.specifier, files);
        const asset = !target && item.asset;
        return {
          ...item,
          asset,
          target:
            target ??
            (asset && item.specifier !== null
              ? importBase(file, item.specifier)
              : undefined),
        };
      }),
    });
  }
  return modules;
}
