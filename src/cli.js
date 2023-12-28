#!/usr/bin/env node
import Invidious from "./invidious.js";
import Youtube from "./youtube.js";
import { writeFileSync } from "fs";
import confirm from '@inquirer/confirm';
import { select } from '@inquirer/prompts';
import checkbox, { Separator } from '@inquirer/checkbox';
import input from '@inquirer/input';
import clipboard from 'clipboardy';
import open from 'open';

const CACHE_ENABLED = false;
const DISABLE_WARNINGS = true;

const originalWarn = console.warn;
console.warn = (...args) => {
    if (DISABLE_WARNINGS) {
        return;
    }
    return originalWarn(...args);
};

(async () => {
    const initialAnswer = await confirm({ message: 'This tool will log into your Youtube account, read your data, and allow\nyou to import it to other platforms, such as Invidious. Continue?' });
    if (!initialAnswer) {
        return;
    }

    const youtube = new Youtube();
    const innertube = await youtube.createSession(CACHE_ENABLED);

    innertube.session.on('auth-pending', async (data) => {
        console.log(`Go to ${data.verification_url} in your browser and enter code ${data.user_code} to authenticate.`);
        const openBrowserAnswer = await confirm({ message: 'Copy code to clipboard and open url in the browser now?' });
        if (openBrowserAnswer) {
            clipboard.writeSync(data.user_code);
            open(data.verification_url);
        }
    });

    innertube.session.on('update-credentials', async ({ credentials }) => {
        console.log('Youtube credentials updated.');
        if (CACHE_ENABLED) {
            await innertube.session.oauth.cacheCredentials();
        }
    });

    await innertube.session.signIn();
    if (CACHE_ENABLED) {
        await innertube.session.oauth.cacheCredentials();
    }

    console.log('Reading library...');
    const libraryPlaylists = await youtube.getLibraryPlaylists()

    const choices = [
        { name: 'Subscriptions', value: 'channels', checked: true },
        { name: 'Watch history', value: 'history', checked: true },
        { name: 'Liked videos', value: 'likedVideos', checked: true },
        { name: 'Watch later', value: 'watchLater', checked: true },
        { name: 'Recommended videos', value: 'homeFeed', checked: true },
    ]

    if (libraryPlaylists.length > 0) {
        choices.push(new Separator('-- Playlists --'));
        for (const playlist of libraryPlaylists) {
            choices.push({ name: playlist.title, value: { playlistId: playlist.id }, checked: true });
        }
    }

    const importChoices = await checkbox({
        message: 'Select the items to import from Youtube',
        choices: choices,
        pageSize: 15,
        loop: false,
        required: true,
    });

    const fields = {};
    for (const choice of importChoices) {
        if (typeof choice === 'string') {
            fields[choice] = true;
        } else {
            fields.playlists = fields.playlists || {};
            fields.playlists[choice.playlistId] = true;
        }
    }

    const profile = await youtube.getProfile(fields);

    const exportChoice = await select({
        message: 'Select platform to export to',
        choices: [
            { name: 'Invidious (direct export)', value: 'invidious_api', disabled: true },
            { name: 'Invidious (save to file)', value: 'invidious_file' },
        ],
    });

    if (exportChoice === 'invidious_api') {
        throw new Error('Not implemented');
    } else if (exportChoice === 'invidious_file') {
        const filename = await input({
            message: 'Enter file name',
            default: 'invidious-profile.json',
            validate: (value) => {
                if (/^[\w\-. ]+$/.test(value) === false) {
                    return 'Please enter a valid file name';
                }
                return true;
            },
        });
        const invidiousProfile = Invidious.profileToInvidiousProfile(profile);
        writeFileSync(filename, JSON.stringify(invidiousProfile, null, 4));
        console.log(`Profile saved to ${filename}`);
    }

    if (!CACHE_ENABLED) {
        console.log('Signing out...');
        await innertube.session.signOut();
    }

    console.log('Done!');
})();