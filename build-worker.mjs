import * as esbuild from "esbuild";

// Node.js built-in modules that ssh2 and its dependencies use.
// Workers with nodejs_compat supports these via the "node:" prefix.
const nodeBuiltins = [
  "assert", "buffer", "child_process", "crypto", "dns", "events",
  "fs", "http", "https", "net", "os", "path", "process", "stream",
  "tls", "url", "util", "zlib",
];

// Plugin that rewrites bare Node built-in imports (e.g. "net") to
// the "node:" scheme (e.g. "node:net") which Workers nodejs_compat expects,
// and stubs out native .node addon requires.
const workerdCompatPlugin = {
  name: "workerd-compat",
  setup(build) {
    // Rewrite bare node built-ins → node: scheme
    build.onResolve(
      { filter: new RegExp(`^(${nodeBuiltins.join("|")})$`) },
      (args) => ({ path: `node:${args.path}`, external: true })
    );

    // Already prefixed node: imports stay external
    build.onResolve({ filter: /^node:/ }, (args) => ({
      path: args.path,
      external: true,
    }));

    // Stub out native .node addon files
    build.onResolve({ filter: /\.node$/ }, () => ({
      path: "noop",
      namespace: "native-addon-stub",
    }));
    build.onLoad(
      { filter: /.*/, namespace: "native-addon-stub" },
      () => ({ contents: "module.exports = undefined;", loader: "js" })
    );
  },
};

await esbuild.build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  outfile: "dist/worker/index.mjs",
  format: "esm",
  target: "es2022",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "import", "require"],
  external: ["cloudflare:*"],
  plugins: [workerdCompatPlugin],
  logLevel: "info",
});
