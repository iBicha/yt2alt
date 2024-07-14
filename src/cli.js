#!/usr/bin/env node
import { Invidious, InvidiousInteractive } from "./invidious.js";
import { YouTube, YouTubeInteractive } from "./youtube.js";
import { Piped } from "./piped.js";
import { NewPipe } from "./newpipe.js";
import { Utils } from "./utils.js";
import { Interactive } from "./interactive.js";
import { FreeTube } from "./freetube.js";
import { ViewTube } from "./viewtube.js";
import { Command } from 'commander';

(async () => {
    Utils.printPackageVersion();

    const program = new Command();
    program
        .option('-c, --cache', 'Cache oauth tokens. This will allow you to run yt2alt multiple times without logging in every time.')
        .option('-d, --debug', 'Enable debug mode. This will print additional information to the console, and log YouTube.js requests to yt2alt-debug.log.');

    program.parse(process.argv);
    const options = program.opts();
    const cacheEnabled = !!options.cache;
    const debugEnabled = !!options.debug;

    const initialAnswer = await YouTubeInteractive.loginDisclaimer();
    if (!initialAnswer) {
        return;
    }

    const youtube = new YouTube({
        cacheEnabled,
        debugEnabled,
    });

    await YouTubeInteractive.login(youtube, options.cache);

    console.log('Reading library...');
    const libraryPlaylists = await youtube.getLibraryPlaylists()

    const fields = await YouTubeInteractive.chooseProfileFields(libraryPlaylists);

    const profile = await youtube.getProfile(fields);

    const exportChoice = await YouTubeInteractive.chooseExportPlatform();

    if (exportChoice === 'invidious_api') {
        const invidiousServer = await InvidiousInteractive.getInvidiousInstance();

        const accessToken = await InvidiousInteractive.loginToInvidious(invidiousServer);

        const invidiousProfile = Invidious.profileToInvidiousProfile(profile);
        // We split the profile into chunks to avoid timeouts.
        // Importing playlists can take a long time since videos are fetched one by one
        // Also it gives a sense of progress to the user
        await Invidious.importProfileChunked(invidiousServer, accessToken, invidiousProfile);

        console.log('Signing out from Invidious...');
        console.log()
        await Invidious.deleteAccessToken(invidiousServer, accessToken);
    } else if (exportChoice === 'invidious_file') {
        const filename = await Interactive.getSavePath('invidious-profile.json', { extension: '.json' });
        const invidiousProfile = Invidious.profileToInvidiousProfile(profile);
        Invidious.writeInvidiousProfileToFile(invidiousProfile, filename);
        console.log(`Profile saved to ${filename}`);
        console.log()
    } else if (exportChoice === 'piped_file') {
        if (fields.history) {
            console.log("Note: watch history is not supported by Piped, and will not be exported.")
            console.log()
        }

        if (fields.channels) {
            const filename = await Interactive.getSavePath('subscriptions.json', { extension: '.json' });
            const pipedSubscriptions = Piped.profileToPipedSubscriptions(profile);
            Piped.writeSubscriptionsToFile(pipedSubscriptions, filename);
            console.log(`Subscriptions saved to ${filename}`);
            console.log()
        }

        if (fields.homeFeed || fields.playlists) {
            const filename = await Interactive.getSavePath('playlists.json', { extension: '.json' });
            const pipedPlaylists = Piped.profileToPipedPlaylists(profile);
            Piped.writePlaylistsToFile(pipedPlaylists, filename);
            console.log(`Playlists saved to ${filename}`);
            console.log()
        }
    } else if (exportChoice === 'newpipe_subs_file') {
        console.log("Note: Only subscriptions will be exported for NewPipe.")
        console.log()

        if (fields.channels) {
            const filename = await Interactive.getSavePath('subscriptions.json', { extension: '.json' });
            const newPipeSubscriptions = NewPipe.profileToNewPipeSubscriptions(profile);
            NewPipe.writeSubscriptionsToFile(newPipeSubscriptions, filename);
            console.log(`Subscriptions saved to ${filename}`);
            console.log()
        }
    } else if (exportChoice === 'freetube_file') {
        console.log("Note: Only subscriptions and watch history will be exported for FreeTube.")
        console.log()

        if (fields.channels) {
            const filename = await Interactive.getSavePath('subscriptions.db', { extension: '.db' });
            const freetubeSubscriptions = FreeTube.profileToFreeTubeSubscriptions(profile);
            FreeTube.writeSubscriptionsToFile(freetubeSubscriptions, filename);
            console.log(`Subscriptions saved to ${filename}`);
            console.log()
        }

        if (fields.history) {
            const filename = await Interactive.getSavePath('history.db', { extension: '.db' });
            const freetubeHistory = FreeTube.profileToFreeTubeHistory(profile);
            FreeTube.writeHistoryToFile(freetubeHistory, filename);
            console.log(`History saved to ${filename}`);
            console.log()
        }
    } else if (exportChoice === 'viewtube_file') {
        console.log("Note: Only subscriptions will be exported for ViewTube.")
        console.log()

        if (fields.channels) {
            const filename = await Interactive.getSavePath('subscriptions.json', { extension: '.json' });
            const viewtubeSubscriptions = ViewTube.profileToViewTubeSubscriptions(profile);
            ViewTube.writeSubscriptionsToFile(viewtubeSubscriptions, filename);
            console.log(`Subscriptions saved to ${filename}`);
            console.log()
        }
    }

    if (!cacheEnabled) {
        await youtube.logout();
    }

    console.log('Done!');
})();