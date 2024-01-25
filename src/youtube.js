import { Innertube, UniversalCache } from 'youtubei.js';
import checkbox, { Separator } from '@inquirer/checkbox';
import { select } from '@inquirer/prompts';
import confirm from '@inquirer/confirm';
import open from 'open';
import clipboard from 'clipboardy';

const PLAYLIST_LIMIT = 100;

export class Youtube {

    async getProfile(fields) {
        const profile = {}

        if (fields.channels) {
            console.log('Reading Subscriptions...');
            const channels = await this.getChannels();
            profile.channels = channels;
        }

        if (fields.history) {
            console.log('Reading Watch history...');
            const history = await this.getWatchHistory();
            profile.history = history;
        }

        if (fields.likedVideos) {
            console.log('Reading Liked videos...');
            const likedVideos = await this.getLikedVideos();
            profile.likedVideos = likedVideos;
        }

        if (fields.watchLater) {
            console.log('Reading Watch later...');
            const watchLater = await this.getWatchLater();
            profile.watchLater = watchLater;
        }

        if (fields.homeFeed) {
            console.log('Reading Recommended videos...');
            const homeFeed = await this.getHomeFeed();
            profile.homeFeed = homeFeed;
        }

        if (fields.playlists) {
            console.log('Reading Playlists...');
            if (fields.playlists === true) {
                profile.playlists = await this.getPlaylistsWithVideos();
            } else {
                profile.playlists = [];
                const libraryPlaylists = await this.getLibraryPlaylists();
                for (const playlist of libraryPlaylists) {
                    console.log(`Reading Playlist: ${playlist.title}`);
                    if (fields.playlists[playlist.id]) {
                        profile.playlists.push(await this.getPlaylistWithVideos(playlist.id));
                    }
                }
            }
        }

        return profile;
    }

    async createSession(useCache = false) {
        if (!this.innertube) {
            if (useCache) {
                this.innertube = await Innertube.create({
                    cache: new UniversalCache(true, "./.cache")
                });
            } else {
                this.innertube = await Innertube.create();
            }
        }
        return this.innertube;
    }

    async logout() {
        console.log('Signing out from Youtube...');
        console.log()
        await this.innertube.session.signOut();
    }

    async getChannels() {
        await this.createSession();
        const feed = await this.innertube.getChannelsFeed();
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

    async getLibrary() {
        await this.createSession();

        if (!this.library) {
            this.library = await this.innertube.getLibrary();
        }
        return this.library;
    }

    async getWatchHistory(limit = PLAYLIST_LIMIT) {
        await this.createSession();

        let history = await this.innertube.getHistory();
        return this.getFeedVideosWithLimit(history, limit);
    }

    async getLikedVideos(limit = PLAYLIST_LIMIT) {
        const library = await this.getLibrary();
        const likedVideos = library.liked_videos;

        const feed = await likedVideos.getAll();
        return this.getFeedVideosWithLimit(feed, limit);
    }

    async getWatchLater(limit = PLAYLIST_LIMIT) {
        const library = await this.innertube.getLibrary();
        const watchLater = library.watch_later;

        const feed = await watchLater.getAll();
        return this.getFeedVideosWithLimit(feed, limit);
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
        const library = await this.getLibrary();
        const playlistsSection = library.playlists_section;
        const contents = await playlistsSection.contents;
        return contents
            .filter(content => content.type === 'Playlist' || content.type === 'GridPlaylist')
            .map(playlist => { return this.toPlaylist(playlist); });
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

export class YoutubeInteractive {
    static async loginDisclaimer() {
        const initialAnswer = await confirm({ message: 'This tool will log into your Youtube account, read your data, and allow\nyou to import it to other platforms, such as Invidious. Continue?' });
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
            console.log('Youtube credentials updated.');
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