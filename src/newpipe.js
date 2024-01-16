export class NewPipe {

    // Note: Piped and NewPipe share the same subscriptions format
    static profileToNewPipeSubscriptions(profile) {
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

}