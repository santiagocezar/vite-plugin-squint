import { compileString } from "squint-cljs/node-api.js";
import type { Plugin } from "vite";

interface SquintPluginOptions {
    paths: string[];
}

const extensions = [".cljs", ".cljc"];

export default function plugin(opts: SquintPluginOptions): Plugin {
    const possiblePaths = opts.paths.flatMap((base) =>
        extensions.map((ext) => ({ base, ext })),
    );

    return {
        name: "squint",

        async load(id) {
            if (id.endsWith(".jsx")) {
                id = id.slice(0, -4);
            }

            this.addWatchFile(id);

            if (extensions.some((ext) => id.endsWith(ext))) {
                const src = await this.fs.readFile(id, { encoding: "utf8" });
                const generated = await compileString(src, {
                    // Leave Java-style namespace resolution to resolveId
                    // (since this function can only return a string synchronously)
                    "resolve-ns": (ns: string) => "squint-cljs-ns:" + ns,
                });
                console.log(generated);
                return {
                    code: generated.javascript,
                };
            }
        },

        async resolveId(id, importer) {
            // Parse a Java-style module identifier
            const [_, ns] = id.split("squint-cljs-ns:", 2);
            if (ns) {
                let path = ns.replace("-", "_").replaceAll(".", "/");

                // Search the paths provided by opts.paths
                const resolved = await Promise.all(
                    possiblePaths.map(({ base, ext }) =>
                        this.resolve(`/${base}/${path}${ext}`),
                    ),
                );

                // Whatever it finds first (.cljs has priority over .cljc)
                for (const r of resolved) {
                    if (r) return r.id + ".jsx";
                }
            }
            // Resolve the (fake) .jsx files
            else if (id.endsWith(".jsx")) {
                id = id.slice(0, -4);
            }

            const resolved = await this.resolve(id, importer);

            if (resolved) {
                return resolved.id + ".jsx";
            }
        },

        handleHotUpdate({ file, server, modules }) {
            if (extensions.some((ext) => file.endsWith(ext))) {
                // this needs to be the same id returned by resolveId this is what
                // vite uses as the modules identifier
                const resolveId = file + ".jsx";
                const module = server.moduleGraph.getModuleById(resolveId);
                if (module) {
                    // invalidate dependants
                    server.moduleGraph.onFileChange(resolveId);
                    // hot reload
                    return [...modules, module];
                }
                return modules;
            }
        },
    };
}
