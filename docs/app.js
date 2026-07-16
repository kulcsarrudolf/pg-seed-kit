(function () {
  "use strict";

  // Per-ORM code examples. Stored as line arrays to avoid template-literal escaping.
  var SNIPPETS = {
    prisma: {
      config: [
        "// pg-seed-kit.config.js",
        'import { prismaAdapter } from "pg-seed-kit/prisma";',
        'import { prisma } from "./db.js"; // your shared PrismaClient',
        "",
        "export default {",
        '  seedersPath: "./prisma/seeders",',
        "  connect: async () => prismaAdapter(prisma),",
        "};",
      ],
      seeder: [
        'import { prisma } from "../../db.js";',
        "",
        "const seed = async (): Promise<void> => {",
        "  await prisma.user.upsert({",
        '    where: { email: "admin@example.com" },',
        "    update: {},",
        '    create: { email: "admin@example.com", role: "admin" },',
        "  });",
        "};",
        "",
        "export default seed;",
      ],
      run: [
        'import { runPendingSeeders } from "pg-seed-kit";',
        'import { prismaAdapter } from "pg-seed-kit/prisma";',
        'import { prisma } from "./db.js";',
        "",
        "await runPendingSeeders({ adapter: prismaAdapter(prisma) });",
      ],
    },

    drizzle: {
      config: [
        "// pg-seed-kit.config.js",
        'import { drizzleAdapter } from "pg-seed-kit/drizzle";',
        'import { db, pool } from "./db.js"; // your drizzle db + pg Pool',
        "",
        "export default {",
        '  seedersPath: "./src/db/seeders",',
        "  connect: async () => drizzleAdapter(db, { close: () => pool.end() }),",
        "};",
      ],
      seeder: [
        'import { db } from "../../db.js";',
        'import { users } from "../schema.js";',
        "",
        "const seed = async (): Promise<void> => {",
        "  await db",
        "    .insert(users)",
        '    .values({ email: "admin@example.com", role: "admin" })',
        "    .onConflictDoNothing();",
        "};",
        "",
        "export default seed;",
      ],
      run: [
        'import { runPendingSeeders } from "pg-seed-kit";',
        'import { drizzleAdapter } from "pg-seed-kit/drizzle";',
        'import { db } from "./db.js";',
        "",
        "await runPendingSeeders({ adapter: drizzleAdapter(db) });",
      ],
    },

    typeorm: {
      config: [
        "// pg-seed-kit.config.js",
        'import { typeormAdapter } from "pg-seed-kit/typeorm";',
        'import { dataSource } from "./data-source.js";',
        "",
        "export default {",
        '  seedersPath: "./src/db/seeders",',
        "  connect: async () => {",
        "    await dataSource.initialize();",
        "    return typeormAdapter(dataSource);",
        "  },",
        "};",
      ],
      seeder: [
        'import { dataSource } from "../../data-source.js";',
        'import { User } from "../entities/User.js";',
        "",
        "const seed = async (): Promise<void> => {",
        "  const repo = dataSource.getRepository(User);",
        '  const exists = await repo.findOneBy({ email: "admin@example.com" });',
        "  if (exists) return;",
        '  await repo.save(repo.create({ email: "admin@example.com", role: "admin" }));',
        "};",
        "",
        "export default seed;",
      ],
      run: [
        'import { runPendingSeeders } from "pg-seed-kit";',
        'import { typeormAdapter } from "pg-seed-kit/typeorm";',
        'import { dataSource } from "./data-source.js";',
        "",
        "// dataSource already initialized by your app",
        "await runPendingSeeders({ adapter: typeormAdapter(dataSource) });",
      ],
    },

    sequelize: {
      config: [
        "// pg-seed-kit.config.js",
        'import { sequelizeAdapter } from "pg-seed-kit/sequelize";',
        'import { sequelize } from "./db.js";',
        "",
        "export default {",
        '  seedersPath: "./src/db/seeders",',
        "  connect: async () => sequelizeAdapter(sequelize),",
        "};",
      ],
      seeder: [
        'import { User } from "../models/User.js";',
        "",
        "const seed = async (): Promise<void> => {",
        "  await User.findOrCreate({",
        '    where: { email: "admin@example.com" },',
        '    defaults: { role: "admin" },',
        "  });",
        "};",
        "",
        "export default seed;",
      ],
      run: [
        'import { runPendingSeeders } from "pg-seed-kit";',
        'import { sequelizeAdapter } from "pg-seed-kit/sequelize";',
        'import { sequelize } from "./db.js";',
        "",
        "await runPendingSeeders({ adapter: sequelizeAdapter(sequelize) });",
      ],
    },
  };

  var KEYWORDS =
    /\b(import|from|export|default|const|let|var|async|await|function|return|new|if|else|void|as|type|interface)\b/g;

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightPlain(text) {
    var s = escapeHtml(text);
    s = s.replace(/\b(\d[\d_]*(?:\.\d+)?)\b/g, '<span class="c-num">$1</span>');
    s = s.replace(KEYWORDS, '<span class="c-kw">$1</span>');
    return s;
  }

  // Extract comments and strings first so keywords inside them are not recolored.
  function highlight(code) {
    var tokenRe =
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
    var out = "";
    var last = 0;
    var m;
    while ((m = tokenRe.exec(code))) {
      out += highlightPlain(code.slice(last, m.index));
      if (m[1]) {
        out += '<span class="c-com">' + escapeHtml(m[1]) + "</span>";
      } else if (m[2]) {
        out += '<span class="c-str">' + escapeHtml(m[2]) + "</span>";
      }
      last = tokenRe.lastIndex;
    }
    out += highlightPlain(code.slice(last));
    return out;
  }

  var ORMS = ["prisma", "drizzle", "typeorm", "sequelize"];
  var STORAGE_KEY = "pg-seed-kit:orm";

  function render(orm) {
    var data = SNIPPETS[orm];
    document.querySelectorAll("[data-snippet]").forEach(function (pre) {
      var key = pre.getAttribute("data-snippet");
      var lines = data[key] || [];
      pre.querySelector("code").innerHTML = highlight(lines.join("\n"));
    });
    document.querySelectorAll(".tab").forEach(function (tab) {
      var selected = tab.getAttribute("data-orm") === orm;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
    });
    try {
      localStorage.setItem(STORAGE_KEY, orm);
    } catch (e) {
      /* ignore */
    }
  }

  function initTabs() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        render(tab.getAttribute("data-orm"));
      });
    });
    var saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      saved = null;
    }
    render(ORMS.indexOf(saved) >= 0 ? saved : "prisma");
  }

  function initCopy() {
    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy");
        navigator.clipboard.writeText(text).then(function () {
          var original = btn.textContent;
          btn.textContent = "Copied";
          btn.classList.add("copied");
          setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove("copied");
          }, 1400);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    initCopy();
  });
})();
