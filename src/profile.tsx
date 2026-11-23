import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { countArchivedVehicles, deleteOwnCategory, listOwnCategories, listVehicles, renameOwnCategory } from "./db";
import type { FormErrors } from "./form";
import { notFound } from "./http";
import { categoryNameProblem } from "./lib/categories";
import { getUserEmail } from "./users";
import { categoryKey, type FailedRename, linesLabel, Profile } from "./views/Profile";

/** The profile page, with errors from a failed rename or delete of one of the owner's categories. */
async function profilePage(c: Context<AppEnv>, errors: FormErrors = {}, typed: FailedRename | null = null) {
  const userId = c.get("userId");
  const [email, vehicles, archived, categories] = await Promise.all([
    getUserEmail(c.env.DB, userId),
    listVehicles(c.env.DB, userId),
    countArchivedVehicles(c.env.DB, userId),
    listOwnCategories(c.env.DB, userId),
  ]);
  return <Profile email={email} vehicles={vehicles} archivedCount={archived} categories={categories} errors={errors} typed={typed} />;
}

/** The user's own category from the :id param, with the names of their others; null if it isn't theirs. */
async function ownedCategory(c: Context<AppEnv>) {
  const all = await listOwnCategories(c.env.DB, c.get("userId"));
  const category = all.find((cat) => cat.id === Number(c.req.param("id")));
  return category ? { category, others: all.filter((cat) => cat !== category).map((cat) => cat.name) } : null;
}

export function profileRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/profile", async (c) => c.html(await profilePage(c)));

  // Renaming a category renames it on every line that uses it. A blank or taken name changes nothing.
  routes.post("/categories/:id{[0-9]+}", async (c) => {
    const owned = await ownedCategory(c);
    if (!owned) return notFound(c);
    const { category, others } = owned;
    const body = await c.req.parseBody();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const problem = categoryNameProblem(name, others);
    if (problem) {
      const errors = { [categoryKey(category.id)]: `${category.name}: ${problem}` };
      return c.html(await profilePage(c, errors, { id: category.id, name }), 400);
    }
    await renameOwnCategory(c.env.DB, c.get("userId"), category.id, name);
    return c.redirect(`/profile#category-${category.id}`, 302);
  });

  // A category lines still use can't be deleted: the owner moves those lines first.
  routes.post("/categories/:id{[0-9]+}/delete", async (c) => {
    const owned = await ownedCategory(c);
    if (!owned) return notFound(c);
    const { category } = owned;
    // The delete checks again, in case a line took the category since it was counted.
    if (category.lines > 0 || !(await deleteOwnCategory(c.env.DB, c.get("userId"), category.id))) {
      const uses = category.lines === 1 ? "1 line uses it. Move it" : `${linesLabel(category.lines)} use it. Move them`;
      const message = `${category.name}: ${uses} to another category, or none, before deleting it.`;
      return c.html(await profilePage(c, { [categoryKey(category.id)]: message }), 409);
    }
    return c.redirect("/profile#categories", 302);
  });

  return routes;
}
