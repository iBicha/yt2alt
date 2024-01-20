import { createRequire } from "module";
const require = createRequire(import.meta.url)
const { version } = require('../package.json')

export class Utils {
    static printPackageVersion() {
        console.log(`yt2alt v${version}`);
        console.log()    
    }
}