import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("application source never invokes native alert, confirm or prompt", () => {
  const violations: string[] = [];
  const dialogs = new Set(["alert", "confirm", "prompt"]);
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { scan(path); continue; }
      if (!/\.[jt]sx?$/.test(path) || path.includes(".test.")) continue;
      const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          const name = ts.isIdentifier(callee) ? callee.text
            : ts.isPropertyAccessExpression(callee) && ["window", "globalThis", "self"].includes(callee.expression.getText(file)) ? callee.name.text
            : ts.isElementAccessExpression(callee) && ["window", "globalThis", "self"].includes(callee.expression.getText(file)) && ts.isStringLiteral(callee.argumentExpression) ? callee.argumentExpression.text : "";
          if (dialogs.has(name)) violations.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  }
  scan("src");
  expect(violations).toEqual([]);
});
