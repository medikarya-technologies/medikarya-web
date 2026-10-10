import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { imageCredit } from "../image-credits";

describe("imageCredit", () => {
  it("credits an image whose licence asks for it", () => {
    assert.match(imageCredit("/investigation-images/mri-brain-normal.jpg") ?? "", /Novaksean, CC BY-SA 4\.0/);
  });

  it("needs nothing for a CC0 image or no image", () => {
    assert.equal(imageCredit("/investigation-images/cxr-pa-normal.jpg"), null);
    assert.equal(imageCredit(undefined), null);
    assert.equal(imageCredit(""), null);
  });

  it("matches with a query string or our own absolute URL", () => {
    assert.ok(imageCredit("/investigation-images/xray-abdomen-normal.jpg?v=2"));
    assert.ok(imageCredit("https://www.medikarya.in/investigation-images/xray-abdomen-normal.jpg"));
  });

  it("every image CREDITS.md says needs attribution is credited", () => {
    const md = fs.readFileSync(path.join(process.cwd(), "public/investigation-images/CREDITS.md"), "utf8");
    const rows = md.split("\n").filter((l) => /^\|\s*[\w.-]+\.(jpe?g|png|webp)\s*\|/.test(l));
    assert.ok(rows.length > 0);
    for (const row of rows) {
      const file = row.split("|")[1].trim();
      const needs = /\*\*Yes\*\*/.test(row);
      assert.equal(imageCredit(`/investigation-images/${file}`) !== null, needs, `${file}: credit ${needs ? "missing" : "not needed"}`);
    }
  });
});
