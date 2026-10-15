import { expect, type Page, test } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "demo-Pass-2026";

async function login(page: Page, username: string, next = "/") {
  await page.goto(`/login/?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("button", { name: `Account menu for ${username}` })).toBeVisible();
}

test("home and post pages are server-rendered with structured data", async ({ page, request }) => {
  const html = await (await request.get("/post/understanding-transformers/")).text();
  expect(html).toContain('"@type":"BlogPosting"');
  expect(html).toContain("Self-attention lets every token");

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Ideas on deep learning/ })).toBeVisible();
  await page.getByRole("link", { name: "Understanding Transformers" }).first().click();
  await expect(page).toHaveURL(/\/post\/understanding-transformers\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Understanding Transformers" })).toBeVisible();
  await expect(page.getByText("Great explanation!")).toBeVisible();

  await page.goto("/?blog=rajan");
  await expect(page.getByRole("link", { name: "Feature Engineering for Tabular Data" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Understanding Transformers" })).toHaveCount(0);
});

test("the command palette searches as you type and opens a post", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search posts and commands" });
  await expect(palette).toBeVisible();
  await page.keyboard.type("retrieval");
  await expect(palette.getByRole("option", { name: /Retrieval Augmented Generation in Practice/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/post\/retrieval-augmented-generation-in-practice\/$/);
  await expect(palette).toBeHidden();
});

test("Ask answers from the blog with numbered sources (passages when no API key is set)", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("how does self-attention work");
  const palette = page.getByRole("dialog", { name: "Search posts and commands" });
  await palette.getByRole("option", { name: /Ask AI: “how does self-attention work”/ }).click();
  await expect(page).toHaveURL(/\/ask\/\?q=how%20does%20self-attention%20work/);
  await expect(page.getByRole("heading", { level: 1, name: "Ask the blog" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  const first = page.locator("#source-1");
  await expect(first).toContainText("Understanding Transformers");
  await expect(first).toContainText("Blog post");
  await first.getByRole("link", { name: /Understanding Transformers/ }).click();
  await expect(page).toHaveURL(/\/post\/understanding-transformers\/$/);
});

test("the search page finds posts", async ({ page }) => {
  await page.goto("/search/?q=retrieval");
  await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Retrieval Augmented Generation in Practice/ })).toBeVisible();
});

test("topic chips and the author switcher filter posts instantly and update the URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Featured")).toBeVisible();
  await page.getByRole("group", { name: "Filter by topic" }).getByRole("button", { name: /Deep Learning/ }).click();
  await expect(page).toHaveURL(/\?topic=deep-learning$/);
  await expect(page.getByRole("link", { name: "Understanding Transformers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Feature Engineering for Tabular Data" })).toHaveCount(0);

  await page.getByRole("group", { name: "Filter by author" }).getByRole("button", { name: "Rajan" }).click();
  await expect(page).toHaveURL(/\?blog=rajan&topic=deep-learning$/);
  await expect(page.getByText("No posts match these filters yet.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No posts match these filters yet.")).toBeVisible();
});

test("post pages have a table of contents, reading progress and copyable code", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/post/understanding-transformers/");
  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc.getByRole("link", { name: "Attention" })).toBeVisible();
  await expect(toc.getByRole("link", { name: "Multiple heads" })).toBeVisible();
  await expect(page.getByText(/\d+ min read/).first()).toBeVisible();

  const progress = page.getByRole("progressbar", { name: "Reading progress" });
  await toc.getByRole("link", { name: "Why it scales" }).click();
  await expect(page).toHaveURL(/#why-it-scales$/);
  await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(0);

  const code = page.locator("#post-content pre").first();
  await code.hover();
  await code.getByRole("button", { name: "Copy code" }).click();
  await expect(code.getByRole("button", { name: "Copy code" })).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("softmax(scores)");
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
  await expect(page.getByRole("button", { name: `Account menu for ${username}` })).toBeVisible();
  const text = `End-to-end comment ${Date.now()}`;
  await page.getByLabel(/Add a comment/).fill(text);
  await page.getByRole("button", { name: "Submit comment" }).click();
  await expect(page.getByText(text)).toBeVisible();
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
});

test("a superuser can publish a post with the editor", async ({ page }) => {
  await login(page, "admin", "/add/");
  await expect(page.getByText("New post", { exact: true })).toBeVisible();
  const title = `E2E post ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Or new category").fill("Testing");
  await page.getByLabel("Post content").click();
  await page.keyboard.type("Written in the rich text editor.");
  await page.getByLabel("Tags").fill("e2e, playwright");
  await page.getByRole("button", { name: "Save post" }).click();

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.locator("#post-content").getByText("Written in the rich text editor.")).toBeVisible();
  await expect(page.getByRole("link", { name: "#playwright" })).toBeVisible();
});

test("Daily Bytes is staff-only and manages sources and interests", async ({ page }) => {
  await page.goto("/bytes/");
  await expect(page).toHaveURL(/\/login\/\?next=%2Fbytes%2F|\/login\/\?next=\/bytes\//);

  await login(page, "reader");
  await page.goto("/bytes/");
  await expect(page.getByText("Daily Bytes is only available to staff accounts.")).toBeVisible();
  await page.goto("/add/");
  await expect(page.getByText("Only administrators can add posts.")).toBeVisible();
  await page.getByRole("button", { name: "Account menu for reader" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await login(page, "admin", "/bytes/");
  await expect(page.getByRole("link", { name: "Sources & interests" })).toBeVisible();
  await page.getByRole("link", { name: "Sources & interests" }).click();

  const interest = `Topic ${Date.now()}`;
  await page.getByRole("textbox", { name: "Interest", exact: true }).fill(interest);
  await page.getByRole("spinbutton", { name: "Priority" }).fill("4");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(interest)).toBeVisible();

  const handle = `writer${Date.now()}`;
  await page.getByLabel("Add by URL").fill(`https://medium.com/@${handle}`);
  await page.getByRole("button", { name: "Add sources" }).click();
  await expect(page.getByText(/Added 1 source/)).toBeVisible();
  await expect(page.getByRole("link", { name: `medium.com/@${handle}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline health" })).toBeVisible();
});

test("Django admin works through the proxy", async ({ page }) => {
  await page.goto("/admin/login/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("link", { name: "Blog posts" })).toBeVisible();
});
