import { expect, test } from "@playwright/test";

test.describe("Smoke: infrastructure connectivity", () => {
  test("frontend home page responds with 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("frontend login page responds with 200", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
  });

  test("backend liveness check returns 200 through the frontend proxy", async ({
    request,
  }) => {
    const response = await request.get("/api/__health/liveness");
    expect(response.status()).toBe(200);
  });

  test("backend readiness check returns 200", async ({ request }) => {
    const response = await request.get("/api/__health/readiness");
    expect(response.status()).toBe(200);
  });
});
