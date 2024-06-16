import { writeFileSync } from "fs";

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

        if (profile.homeFeed) {
            playlists.push({
                name: 'Recommended',
                type: "playlist",
                visibility: 'private',
                videos: profile.homeFeed.map(video => `https://www.youtube.com/watch?v=${video.id}`),
            });
        }

        if (profile.playlists) {
            for (const playlist of profile.playlists) {
                playlists.push({
                    name: playlist.title,
                    type: "playlist",
                    visibility: Piped.privacyToPipedVisibility(playlist.privacy),
                    videos: playlist.videos.map(video => `https://www.youtube.com/watch?v=${video.id}`),
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

    static writeSubscriptionsToFile(pipedSubscriptions, filename) {
        writeFileSync(filename, JSON.stringify(pipedSubscriptions, null, 4));
    }

    static writePlaylistsToFile(pipedPlaylists, filename) {
        writeFileSync(filename, JSON.stringify(pipedPlaylists, null, 4));
    }
}