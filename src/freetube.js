import { writeFileSync } from "fs";

export class FreeTube {
    static profileToFreeTubeSubscriptions(profile) {
        if (!profile.channels) {
            return undefined;
        }

        return {
            _id: "allChannels",
            name: "All Channels",
            bgColor: "#BD93F9",
            textColor: "#000000",
            subscriptions: profile.channels.map(channel => {
                return {
                    id: channel.id,
                    name: channel.name,
                    thumbnail: channel.thumbnail,
                };
            }),
        }
    }

    static profileToFreeTubeHistory(profile) {
        if (!profile.history) {
            return undefined;
        }

        return profile.history.map(video => {
            return {
                videoId: video.id,
                title: video.title,
                author: video.author,
                authorId: video.authorId,
                published: video.published || 0,
                description: video.description,
                viewCount: parseInt((video.viewCount || '0').split("").filter(c => c >= '0' && c <= '9').join("")),
                lengthSeconds: video.lengthSeconds,
                watchProgress: 0,
                timeWatched: 0,
                isLive: video.isLive,
                type: 'video',
            };
        });
    }

    static writeSubscriptionsToFile(freeTubeSubscriptions, filename) {
        const content = JSON.stringify(freeTubeSubscriptions) + '\n'
        writeFileSync(filename, content);
    }

    static writeHistoryToFile(freeTubeHistory, filename) {
        const content = freeTubeHistory.map(video => JSON.stringify(video)).join('\n') + '\n'
        writeFileSync(filename, content);
    }
}