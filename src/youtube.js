import { Innertube, UniversalCache, Log, Platform } from 'youtubei.js';
import checkbox, { Separator } from '@inquirer/checkbox';
import { select } from '@inquirer/prompts';
import confirm from '@inquirer/confirm';
import open from 'open';
import clipboard from 'clipboardy';
import { writeFileSync } from 'fs';

const PLAYLIST_LIMIT = 100;

async function fetchMiddleware(input, init, debugFile) {
    const url = typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
            ? input
            : new URL(input.url);

    const method = init?.method || input?.method || 'GET';

    const headers = init?.headers
        ? new Headers(init.headers)
        : input instanceof Request
            ? input.headers
            : new Headers();

    const body = init?.body || (input instanceof Request ? input.body : null);

    let log = `${new Date().toISOString()} - Request: ${method} ${url.toString()}\n`;
    log += 'Request Headers:\n';
    for (const [key, value] of headers.entries()) {
        log += `  ${key}: ${value}\n`;
    }
    if (body) {
        log += 'Body:\n';
        log += body + '\n';
    }

    const response = await Platform.shim.fetch(input, init);

    log += `Response: ${response.status} ${response.statusText}\n`;
    log += 'Response Headers:\n';
    for (const [key, value] of response.headers.entries()) {
        log += `  ${key}: ${value}\n`;
    }
    // body
    const text = await response.text();
    log += text + '\n\n';
    writeFileSync(debugFile, log, { flag: 'a' });

    response.text = async () => text;
    response.json = async () => JSON.parse(text);

    return response;
}

export class YouTube {

    constructor(opts) {
        this.cacheEnabled = opts?.cacheEnabled || false;
        this.debugEnabled = opts?.debugEnabled || false;

        if (this.debugEnabled) {
            Log.setLevel(Log.Level.ERROR, Log.Level.WARNING, Log.Level.INFO, Log.Level.DEBUG);
        }
    }

    async getProfile(fields) {
        const profile = {}

        if (fields.channels) {
            console.log('Reading Subscriptions...');
            profile.channels = await this.getChannels();
        }

        if (fields.history) {
            console.log('Reading Watch history...');
            profile.history = await this.getWatchHistory();
        }

        if (fields.homeFeed) {
            console.log('Reading Recommended videos...');
            profile.homeFeed = await this.getHomeFeed();
        }

        if (fields.playlists) {
            console.log('Reading Playlists...');
            if (fields.playlists === true) {
                profile.playlists = await this.getPlaylistsWithVideos();
            } else {
                profile.playlists = [];
                const libraryPlaylists = await this.getLibraryPlaylists();
                for (const playlist of libraryPlaylists) {
                    if (fields.playlists[playlist.id]) {
                        console.log(`Reading Playlist: ${playlist.title}`);
                        profile.playlists.push(await this.getPlaylistWithVideos(playlist.id));
                    }
                }
            }
        }

        return profile;
    }

    async createSession() {
        if (!this.innertube) {
            const innertubeConfig = {};
            if (this.cacheEnabled) {
                innertubeConfig.cache = new UniversalCache(true, "./.cache");
            }
            if (this.debugEnabled) {
                innertubeConfig.fetch = async (input, init) => {
                    return fetchMiddleware(input, init, 'yt2alt-debug.log');
                }
            }

            this.innertube = await Innertube.create(innertubeConfig);
        }
        return this.innertube;
    }

    async logout() {
        console.log('Signing out from YouTube...');
        console.log()
        await this.innertube.session.signOut();
    }

    async getChannels() {
        await this.createSession();
        let feed = await this.innertube.getChannelsFeed();
        const channels = feed.channels.map(channel => {
            return this.toChannel(channel);
        });

        while (feed.has_continuation) {
            try {
                feed = await feed.getContinuation();
                channels.push(...feed.channels.map(channel => {
                    return this.toChannel(channel);
                }));
            } catch (error) {
                console.error(error);
                break;
            }
        }
        return channels;
    }

    async getWatchHistory(limit = PLAYLIST_LIMIT) {
        await this.createSession();

        const history = await this.innertube.getHistory();
        return this.getFeedVideosWithLimit(history, limit);
    }

    async getHomeFeed(limit = PLAYLIST_LIMIT) {
        await this.createSession();

        const feed = await this.innertube.getHomeFeed();
        return this.getFeedVideosWithLimit(feed, limit);
    }

    async getPlaylistsWithVideos(limit = PLAYLIST_LIMIT) {
        const playlists = [];
        const libraryPlaylists = await this.getLibraryPlaylists();
        for (const playlist of libraryPlaylists) {
            playlists.push(await this.getPlaylistWithVideos(playlist.id, limit));
        }
        return playlists;
    }

    async getLibraryPlaylists() {
        await this.createSession();
        const feed = await this.innertube.getPlaylists();

        let playlists = feed.playlists;

        while (feed.has_continuation) {
            try {
                feed = await feed.getContinuation();
                playlists.push(...feed.playlists);
            } catch (error) {
                console.error(error);
                break;
            }
        }

        return playlists.map(playlist => this.toPlaylist(playlist))
            // filter out mix playlists, they are not viewable and will throw an error
            .filter(playlist => !playlist.id.startsWith('RD'));
    }

    async getPlaylistWithVideos(playlistId, limit = PLAYLIST_LIMIT) {
        await this.createSession();

        let playlist = await this.innertube.getPlaylist(playlistId);

        const videos = await this.getFeedVideosWithLimit(playlist, limit);

        return this.toPlaylistWithVideos(playlist, videos);
    }

    async getFeedVideosWithLimit(feed, limit = PLAYLIST_LIMIT) {
        const videos = [];
        while (limit === -1 || videos.length < limit) {
            try {
                videos.push(...feed.videos);
                if (!feed.has_continuation) {
                    break;
                }
                feed = await feed.getContinuation();
            } catch (error) {
                console.error(error);
                break;
            }
        }

        return videos.slice(0, limit)
            .map(video => this.toVideo(video));
    }

    toVideo(video) {
        return {
            id: video.id,
            title: video.title.text,
            author: video.author?.name || "",
            authorId: video.author?.id || "",
            published: video.published?.text || "", //? undefined?
            description: video.description,
            viewCount: video.view_count?.text || "", // '1,926,729 views'
            lengthSeconds: video.duration?.seconds || 0,
            isLive: !!video.is_live,
        }
    }

    toChannel(channel) {
        let thumbnail = channel.author.best_thumbnail.url;
        if (thumbnail && thumbnail.startsWith('//')) {
            thumbnail = `https:${thumbnail}`;
        }
        return {
            id: channel.id,
            name: channel.author.name,
            thumbnail: thumbnail,
        }
    }

    toPlaylist(playlist) {
        // from FEplaylist_aggregation
        if (playlist.type === 'LockupView' && playlist.content_type === 'PLAYLIST') {
            return {
                id: playlist.content_id,
                title: playlist.metadata.title.text,
            };
        }

        return {
            id: playlist.id,
            title: playlist.title.text
        }
    }

    toPlaylistWithVideos(playlist, videos) {
        return {
            id: playlist.id,
            title: playlist.info.title,
            description: playlist.info.description,
            privacy: playlist.info.privacy,
            videos: videos,
        };
    }
}

export class YouTubeInteractive {
    static async loginDisclaimer() {
        const initialAnswer = await confirm({
            message: `This tool will log into your YouTube account, read your data, and allow
you to import it to other platforms.
You will get to choose which data to import and where to export it.
Continue?` });
        console.log()
        return initialAnswer;
    }

    static async login(youtube, cacheEnabled) {
        const innertube = await youtube.createSession(cacheEnabled);

        innertube.session.on('auth-pending', async (data) => {
            console.log(`Go to ${data.verification_url} in your browser and enter code ${data.user_code} to authenticate.`);
            const openBrowserAnswer = await confirm({ message: 'Copy code to clipboard and open url in the browser now?' });
            if (openBrowserAnswer) {
                clipboard.writeSync(data.user_code);
                open(data.verification_url);
            }
        });

        innertube.session.on('update-credentials', async ({ credentials }) => {
            console.log('YouTube credentials updated.');
            if (cacheEnabled) {
                await innertube.session.oauth.cacheCredentials();
            }
        });

        await innertube.session.signIn();
        if (cacheEnabled) {
            await innertube.session.oauth.cacheCredentials();
        }

        console.log()
    }

    static async chooseProfileFields(libraryPlaylists) {
        const choices = [
            { name: 'Subscriptions', value: 'channels', checked: true },
            { name: 'Watch history', value: 'history', checked: true },
            { name: 'Recommended videos', value: 'homeFeed', checked: true },
        ]

        if (libraryPlaylists.length > 0) {
            choices.push(new Separator('-- Playlists --'));
            for (const playlist of libraryPlaylists) {
                choices.push({ name: playlist.title, value: { playlistId: playlist.id }, checked: true });
            }
        }

        const importChoices = await checkbox({
            message: 'Select the items to import from YouTube',
            choices: choices,
            pageSize: 15,
            loop: false,
            required: true,
        });
        console.log()

        const fields = {};
        for (const choice of importChoices) {
            if (typeof choice === 'string') {
                fields[choice] = true;
            } else {
                fields.playlists = fields.playlists || {};
                fields.playlists[choice.playlistId] = true;
            }
        }

        return fields;
    }

    static async chooseExportPlatform() {
        const exportChoice = await select({
            message: 'Select platform to export to',
            choices: [
                { name: 'Invidious (API import)', value: 'invidious_api' },
                { name: 'Invidious (save to file)', value: 'invidious_file' },
                { name: 'Piped (save to file)', value: 'piped_file' },
                { name: 'NewPipe (Subscriptions only) (save to file)', value: 'newpipe_subs_file' },
                { name: 'FreeTube (Subscriptions and History only) (save to file)', value: 'freetube_file' },
                { name: 'ViewTube (Subscriptions only) (save to file)', value: 'viewtube_file' },
            ],
        });
        console.log();

        return exportChoice;
    }
}