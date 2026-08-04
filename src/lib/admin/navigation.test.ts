import { describe, expect, it } from "vitest";

import { isAdminHrefActive } from "./navigation";

describe("admin navigation", () => {
  it("does not keep Dashboard active on every child page", () => {
    expect(isAdminHrefActive("/admin/users", "/admin")).toBe(false);
    expect(isAdminHrefActive("/admin", "/admin")).toBe(true);
  });

  it("keeps a section active on its child paths", () => {
    expect(isAdminHrefActive("/admin/users/example", "/admin/users")).toBe(
      true,
    );
  });

  it("normalizes trailing slashes", () => {
    expect(isAdminHrefActive("/admin/users/", "/admin/users")).toBe(true);
  });
});
