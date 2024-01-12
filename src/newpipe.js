import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { createWriteStream, existsSync, unlinkSync } from 'fs';
import archiver from 'archiver';

const DB_IN_ZIP_NAME = 'newpipe.db';

export class NewPipe {

    static async createNewPipeProfile(profile, filename) {
        const tmpDbPath = 'newpipe.tmp.db';
        if (existsSync(tmpDbPath)) {
            unlinkSync(tmpDbPath);
        }
        await this.createDatabase(profile, tmpDbPath);
        await this.zipDatabase(tmpDbPath, filename);
        unlinkSync(tmpDbPath);
    }

    static async createDatabase(profile, tmpDbPath) {
        const db = await open({
            filename: tmpDbPath,
            driver: sqlite3.Database
        })

        // TODO: add profile to db
        await db.exec('CREATE TABLE tbl (col TEXT)')
        await db.exec('INSERT INTO tbl VALUES ("test")')
        
        await db.close()
    }

    static async zipDatabase(tmpDbPath, zipPath) {
        if (existsSync(zipPath)) {
            unlinkSync(zipPath);
        }
        return new Promise((resolve, reject) => {
            const output = createWriteStream(zipPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
            });
            output.on('close', function () {
                resolve();
            });
            archive.on('error', function (err) {
                reject(err);
            });
            archive.pipe(output);
            archive.file(tmpDbPath, { name: DB_IN_ZIP_NAME });
            archive.finalize();
        })
    }
}