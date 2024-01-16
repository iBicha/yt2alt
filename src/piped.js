export class Piped {
    
    // Note: Piped and NewPipe share the same subscriptions format
    static profileToPipedSubscriptions(profile) {
        if (!profile.channels) {
            return undefined;
        }

        return {
            app_version: "",
            app_version_int: 0,
            subscriptions: profile.channels.map(channel => {
                return {
                    url: `https://www.youtube.com/channel/${channel.id}`,
                    name: channel.name,
                    service_id: 0
                };
            }),
        };
    }

    static profileToPipedPlaylists(profile) {
        const playlists = [];

        if (profile.likedVideos) {
            playlists.push({
                name: 'Liked videos',
                type: "playlist",
                visibility: 'private',
                videos: profile.likedVideos.map(id => `https://www.youtube.com/watch?v=${id}`),
            });
        }

        if (profile.watchLater) {
            playlists.push({
                name: 'Watch later',
                type: "playlist",
                visibility: 'private',
                videos: profile.watchLater.map(id => `https://www.youtube.com/watch?v=${id}`),
            });
        }

        if (profile.homeFeed) {
            playlists.push({
                name: 'Recommended',
                type: "playlist",
                visibility: 'private',
                videos: profile.homeFeed.map(id => `https://www.youtube.com/watch?v=${id}`),
            });
        }

        if (profile.playlists) {
            for (const playlist of profile.playlists) {
                playlists.push({
                    name: playlist.title,
                    type: "playlist",
                    visibility: Piped.privacyToPipedVisibility(playlist.privacy),
                    videos: playlist.videos.map(id => `https://www.youtube.com/watch?v=${id}`),
                });
            }
        }

        return {
            format: "Piped",
            version: 1,
            playlists: playlists,
        }
    }

    static privacyToPipedVisibility(privacy) {
        if (!privacy) {
            return 'private';
        }

        privacy = privacy.toLowerCase();
        switch (privacy) {
            case 'public':
                return 'public';
            case 'unlisted':
                return 'unlisted';
            default:
                return 'private';
        }
    }
}