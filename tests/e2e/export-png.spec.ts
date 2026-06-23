import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("exports topology PNG with visible edge paths", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("path.react-flow__edge-path:not(.dimmed-edge)");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出拓扑 PNG" }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();

  const imageBase64 = (await readFile(filePath as string)).toString("base64");
  const result = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(image, 0, 0);

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let edgeColorPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      if (alpha < 180) continue;

      const blueEdge = red < 125 && green > 125 && green < 190 && blue > 210;
      const rewriteEdge = red > 190 && green < 140 && blue > 190;
      const dynamicEdge = red > 200 && green > 145 && green < 215 && blue < 140;
      if (blueEdge || rewriteEdge || dynamicEdge) edgeColorPixels += 1;
    }

    return {
      width: canvas.width,
      height: canvas.height,
      edgeColorPixels
    };
  }, imageBase64);

  expect(result.width).toBeGreaterThan(1000);
  expect(result.height).toBeGreaterThan(800);
  expect(result.edgeColorPixels).toBeGreaterThan(500);
});
