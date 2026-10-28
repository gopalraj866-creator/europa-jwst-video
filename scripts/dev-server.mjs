// Live preview in your own browser (uses your GPU): npm run dev
import { startServer } from './serve.mjs';
const { port } = await startServer(5173);
console.log(`\n  Preview 16:9  → http://localhost:${port}/src/index.html?preview=1&bake=0.5`);
console.log(`  Preview 9:16  → http://localhost:${port}/src/index.html?preview=1&mode=short&bake=0.5\n  (run  npm run audio  first if you also want to hear the soundtrack)\n`);
