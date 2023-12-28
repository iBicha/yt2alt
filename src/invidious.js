
const PLAYLIST_DESCRIPTION = '[Automatically imported from Youtube using yt2alt]';

export default class Invidious {

   static profileToInvidiousProfile(profile) {
        const invidiousProfile = {}

        if (profile.channels) {
            invidiousProfile.subscriptions = profile.channels;
        }

        if (profile.history) {
            invidiousProfile.watch_history = profile.history;
        }

        // There's no liked videos, watch later, or recommended feed in Invidious, we import them as a playlists
        if (profile.likedVideos) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            invidiousProfile.playlists.push({
                title: 'Liked videos',
                description: PLAYLIST_DESCRIPTION,
                privacy: 'private',
                videos: profile.likedVideos,
            });
        }

        if (profile.watchLater) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            invidiousProfile.playlists.push({
                title: 'Watch later',
                description: PLAYLIST_DESCRIPTION,
                privacy: 'private',
                videos: profile.watchLater,
            });
        }

        if (profile.homeFeed) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            invidiousProfile.playlists.push({
                title: 'Recommended',
                description: PLAYLIST_DESCRIPTION,
                privacy: 'private',
                videos: profile.homeFeed,
            });
        }

        if (profile.playlists) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            for (const playlist of profile.playlists) {
                invidiousProfile.playlists.push({
                    title: playlist.title,
                    description: PLAYLIST_DESCRIPTION + (playlist.description ? `\n${playlist.description}` : ''),
                    privacy: Invidious.privacyToInvidiousPrivacy(playlist.privacy),
                    videos: playlist.videos,
                });
            }
        }

        return invidiousProfile;
    }

    static privacyToInvidiousPrivacy(privacy) {
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