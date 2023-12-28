import { Innertube, UniversalCache } from 'youtubei.js';

export default class Youtube {

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

    async getChannels() {
        await this.createSession();

        const feed = await this.innertube.getChannelsFeed();
        const channels = feed.channels.map(channel => channel.id);

        while (feed.has_continuation) {
            try {
                feed = await feed.getContinuation();
                channels.push(...feed.channels.map(channel => channel.id));
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

    async getWatchHistory(limit = 100) {
        await this.createSession();

        let history = await this.innertube.getHistory();
        return this.getFeedVideosWithLimit(history, limit);
    }

    async getLikedVideos(limit = 100) {
        const library = await this.getLibrary();
        const likedVideos = library.liked_videos;

        const feed = await likedVideos.getAll();
        return this.getFeedVideosWithLimit(feed, limit);
    }

    async getWatchLater(limit = 100) {
        const library = await this.innertube.getLibrary();
        const watchLater = library.watch_later;

        const feed = await watchLater.getAll();
        return this.getFeedVideosWithLimit(feed, limit);
    }

    async getHomeFeed(limit = 100) {
        await this.createSession();

        const feed = await this.innertube.getHomeFeed();
        return this.getFeedVideosWithLimit(feed, limit);
    }

    async getPlaylistsWithVideos(limit = 100) {
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
            .map(playlist => ({ id: playlist.id, title: playlist.title.text }));
    }

    async getPlaylistWithVideos(playlistId, limit = 100) {
        await this.createSession();

        let playlist = await this.innertube.getPlaylist(playlistId);

        return {
            title: playlist.info.title,
            description: playlist.info.description,
            privacy: playlist.info.privacy,
            videos: await this.getFeedVideosWithLimit(playlist, limit),
        };
    }

    async getFeedVideosWithLimit(feed, limit = 100) {
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
        return videos.slice(0, limit).map(video => video.id);
    }
}
