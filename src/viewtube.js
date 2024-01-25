import { writeFileSync } from "fs";

export class ViewTube {
    static profileToViewTubeSubscriptions(profile) {
        if (!profile.channels) {
            return undefined;
        }

        return profile.channels.map(channel => {
            return {
                author: channel.name,
                authorId: channel.id,
            };
        })
    }

    static writeSubscriptionsToFile(viewTubeSubscriptions, filename) {
        writeFileSync(filename, JSON.stringify(viewTubeSubscriptions, null, 4));
    }
}