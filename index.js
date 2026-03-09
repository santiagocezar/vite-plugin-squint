import { compileString } from "squint-cljs/node-api.js";

/**
 * @typedef SquintPluginOptions
 * @prop {string[]} paths Aa
 */

/**
 * @param {SquintPluginOptions} opts
 * @returns {import("vite").Plugin}
 **/
export default function plugin(opts) {
    const possiblePaths = opts.paths.flatMap((base) => [
        { base, ext: "cljs" },
        { base, ext: "cljc" },
    ]);

    return {
        name: "squint",

        async transform(src, id) {
            if (id.endsWith(".cljs") || id.endsWith(".cljc")) {
                const generated = await compileString(src, {
                    // leave namespace resolution to resolveId
                    "resolve-ns": (ns) => {
                        console.log(ns);
                        return "squint-cljs-ns:" + ns;
                    },
                });
                console.log(generated);
                return {
                    code: generated.javascript,
                };
            }
        },

        async resolveId(id) {
            // parse the virtual module identifier
            const [_, ns] = id.split("squint-cljs-ns:", 2);
            if (ns) {
                let path = ns.replace("-", "_").replaceAll(".", "/");

                // resolve modules from the root of the project
                // using the base provided by opts.paths
                const resolved = await Promise.all(
                    possiblePaths.map(({ base, ext }) =>
                        this.resolve(`/${base}/${path}.${ext}`),
                    ),
                );

                for (const r of resolved) {
                    if (r) return r.id;
                }
            }
        },
    };
}
