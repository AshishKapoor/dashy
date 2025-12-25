import { defineConfig } from "orval";

export default defineConfig({
  dashy: {
    input: "./schema/dashy.yaml",
    output: {
      target: "./app/client/gen/dashy/index.ts",
      schemas: "./app/client/gen/dashy",
      client: "react-query",
      mode: "tags-split",
      mock: false,
      prettier: true,
      override: {
        mutator: {
          path: "./app/client/http-dashy-client.ts",
          name: "httpDashyClient",
        },
      },
    },
    // hooks: {
    //   afterAllFilesWrite: "yarn format",
    // },
  },
});
