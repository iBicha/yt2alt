import { existsSync } from "fs";
import confirm from '@inquirer/confirm';
import input from '@inquirer/input';

export class Interactive {
    static async getSavePath(defaultPath, opts) {
        const extension = opts.extension;
        const errorMessage = opts.errorMessage || 'Please enter a valid file name';
        let filename = ''
        let validFilename = false;
        while (!validFilename) {
            filename = await input({
                message: 'Enter file name',
                default: defaultPath,
                validate: (value) => {
                    if (/^[\w\-. ]+$/.test(value) === false) {
                        return errorMessage;
                    }
                    if (extension && !value.endsWith(extension)) {
                        return `File name must end with ${extension}`;
                    }
                    return true;
                },
            });
            validFilename = true;

            if (existsSync(filename)) {
                const overwrite = await confirm({ message: 'File already exists. Overwrite?' });
                if (!overwrite) {
                    validFilename = false;
                    continue;
                }
            }
        }
        console.log()

        return filename;
    }
}