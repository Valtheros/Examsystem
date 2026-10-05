import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each(["compose.yaml", "compose.app.yaml", "compose.production.yaml"])(
  "%s disables automatic restart for every service",
  (filename) => {
    const source = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8").replaceAll("\r", "");
    const services = source.split(/^services:\s*$/m)[1].split(/^\S/m)[0];
    const serviceCount = services.match(/^  [\w-]+:/gm)?.length ?? 0;
    expect(serviceCount).toBeGreaterThan(0);
    expect(services.match(/^    restart: "no"$/gm)).toHaveLength(serviceCount);
  },
);
