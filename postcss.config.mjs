import path from "path";
import { fileURLToPath } from "url";

/** Folder with `package.json` / `node_modules` — avoids wrong `base` when cwd is a parent directory. */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** Next.js expects `plugins: { "package-name": options }`, not a raw plugin instance array. */
export default {
  plugins: {
    "@tailwindcss/postcss": {
      base: appRoot,
    },
  },
};
