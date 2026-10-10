import { expect, type Page, test } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "demo-Pass-2026";

async function login(page: Page, username: string, next = "/") {
  await page.goto(`/login/?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText(`Hi, ${username}`)).toBeVisible();
}

test("home and post pages are server-rendered with structured data", async ({ page, request }) => {
  const html = await (await request.get("/post/understanding-transformers/")).text();
  expect(html).toContain('"@type":"BlogPosting"');
  expect(html).toContain("Self-attention lets every token");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Thoughts and Posts" })).toBeVisible();
  await page.getByRole("link", { name: "Understanding Transformers" }).first().click();
  await expect(page).toHaveURL(/\/post\/understanding-transformers\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Understanding Transformers" })).toBeVisible();
  await expect(page.getByText("Great explanation!")).toBeVisible();

  await page.goto("/?blog=rajan");
  await expect(page.getByRole("link", { name: "Feature Engineering for Tabular Data" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Understanding Transformers" })).toHaveCount(0);
});

test("search finds posts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByLabel("Search").fill("retrieval");
  await page.getByRole("navigation").getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: /Search results for/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retrieval Augmented Generation in Practice" })).toBeVisible();
});

test("a visitor can register and comment", async ({ page }) => {
  const username = `user${Date.now()}`;
  await page.goto("/post/understanding-transformers/");
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login\/\?next=/);
  await page.getByRole("main").getByRole("link", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/register\/\?next=/);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-Long-pass-123");
  await page.getByLabel("Confirm password").fill("a-Long-pass-123");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page).toHaveURL(/\/post\/understanding-transformers\/$/);
  await expect(page.getByText(`Hi, ${username}`)).toBeVisible();
  const text = `End-to-end comment ${Date.now()}`;
  await page.getByLabel(/Add a comment/).fill(text);
  await page.getByRole("button", { name: "Submit comment" }).click();
  await expect(page.getByText(text)).toBeVisible();
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
});

test("a superuser can publish a post with the editor", async ({ page }) => {
  await login(page, "admin", "/add/");
  await expect(page.getByRole("heading", { name: "Create a new post" })).toBeVisible();
  const title = `E2E post ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Or new category").fill("Testing");
  await page.getByLabel("Post content").click();
  await page.keyboard.type("Written in the rich text editor.");
  await page.getByLabel("Tags").fill("e2e, playwright");
  await page.getByRole("button", { name: "Save post" }).click();

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Written in the rich text editor.")).toBeVisible();
  await expect(page.getByRole("link", { name: "playwright" })).toBeVisible();
});

test("Daily Bytes is staff-only and manages sources and interests", async ({ page }) => {
  await page.goto("/bytes/");
  await expect(page).toHaveURL(/\/login\/\?next=%2Fbytes%2F|\/login\/\?next=\/bytes\//);

  await login(page, "reader");
  await page.goto("/bytes/");
  await expect(page.getByText("Daily Bytes is only available to staff accounts.")).toBeVisible();
  await page.goto("/add/");
  await expect(page.getByText("Only administrators can add posts.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();

  await login(page, "admin", "/bytes/");
  await expect(page.getByRole("link", { name: "Sources & interests" })).toBeVisible();
  await page.getByRole("link", { name: "Sources & interests" }).click();

  const interest = `Topic ${Date.now()}`;
  await page.getByLabel("Interest").fill(interest);
  await page.getByLabel("Priority").fill("4");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(interest)).toBeVisible();

  const handle = `writer${Date.now()}`;
  await page.getByLabel("Add by URL").fill(`https://medium.com/@${handle}`);
  await page.getByRole("button", { name: "Add sources" }).click();
  await expect(page.getByText(/Added 1 source/)).toBeVisible();
  await expect(page.getByRole("link", { name: `medium.com/@${handle}` })).toBeVisible();
});

test("Django admin works through the proxy", async ({ page }) => {
  await page.goto("/admin/login/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("link", { name: "Blog posts" })).toBeVisible();
});
