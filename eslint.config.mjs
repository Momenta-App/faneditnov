import { defineConfig } from "eslint/config";
import nextConfig from "eslint-config-next";

export default defineConfig([
  ...nextConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/env-server"],
              message: "Do not import server env into client components"
            },
            {
              group: ["@/lib/supabase"],
              message: "Do not import server Supabase client into client components"
            }
          ]
        }
      ]
    }
  }
]);