import { writeFileSync } from "fs";
import express from 'express'
import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import open from 'open';

const PLAYLIST_DESCRIPTION = '[Automatically imported from YouTube using yt2alt]';

const INVIDIOUS_SCOPES = "POST:tokens/unregister,POST:import/invidious"

export class Invidious {

   static profileToInvidiousProfile(profile) {
        const invidiousProfile = {}

        if (profile.channels) {
            invidiousProfile.subscriptions = profile.channels.map(channel => channel.id);
        }

        if (profile.history) {
            invidiousProfile.watch_history = profile.history.map(video => video.id);
        }

        // There's no liked videos, watch later, or recommended feed in Invidious, we import them as a playlists
        if (profile.likedVideos) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            invidiousProfile.playlists.push({
                title: 'Liked videos',
                description: PLAYLIST_DESCRIPTION,
                privacy: 'private',
                videos: profile.likedVideos.map(video => video.id),
            });
        }

        if (profile.watchLater) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            invidiousProfile.playlists.push({
                title: 'Watch later',
                description: PLAYLIST_DESCRIPTION,
                privacy: 'private',
                videos: profile.watchLater.map(video => video.id),
            });
        }

        if (profile.homeFeed) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            invidiousProfile.playlists.push({
                title: 'Recommended',
                description: PLAYLIST_DESCRIPTION,
                privacy: 'private',
                videos: profile.homeFeed.map(video => video.id),
            });
        }

        if (profile.playlists) {
            invidiousProfile.playlists = invidiousProfile.playlists || [];
            for (const playlist of profile.playlists) {
                invidiousProfile.playlists.push({
                    title: playlist.title,
                    description: PLAYLIST_DESCRIPTION + (playlist.description ? `\n${playlist.description}` : ''),
                    privacy: Invidious.privacyToInvidiousPrivacy(playlist.privacy),
                    videos: playlist.videos.map(video => video.id),
                });
            }
        }

        return invidiousProfile;
    }

    static async importProfileChunked(invidiousServer, accessToken, invidiousProfile) {
        const profileChunks = Invidious.invidiousProfileToChunks(invidiousProfile);
        for (let i = 0; i < profileChunks.length; i++) {
            const chunk = profileChunks[i];
            console.log(`Importing profile to Invidious (${chunk.name}) [${i + 1} of ${profileChunks.length}]...`);
            await Invidious.importProfile(invidiousServer, accessToken, chunk.payload);
        }

        console.log()
    }

    static async importProfile(invidiousInstance, accessToken, invidiousProfile) {
        await fetch(`${invidiousInstance}/api/v1/auth/import/invidious`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify(invidiousProfile)
        })
    }

    static invidiousProfileToChunks(invidiousProfile) {
        const chunks = [];
        if (invidiousProfile.subscriptions) {
            chunks.push({
                name: 'Subscriptions',
                payload: {
                    subscriptions: invidiousProfile.subscriptions,
                },
            });
        }

        if (invidiousProfile.watch_history) {
            chunks.push({
                name: 'Watch history',
                payload: {
                    watch_history: invidiousProfile.watch_history,
                },
            });
        }

        if (invidiousProfile.playlists) {
            for (const playlist of invidiousProfile.playlists) {
                chunks.push({
                    name: playlist.title,
                    payload: {
                        playlists: [playlist],
                    },
                });
            }
        }

        return chunks;
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

    static async pingServer(server) {
        const url = `${server}/api/v1/stats`
        try {
            const response = await fetch(url)
            if (!response.ok) {
                return false;
            }
            const json = await response.json();
            return json && !!json.software;
        } catch (error) {
            console.error(`Failed to ping server ${url}`);
            return false;
        }
    }

    static async deleteAccessToken(invidiousInstance, accessToken) {
        await fetch(`${invidiousInstance}/api/v1/auth/tokens/unregister`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: accessToken
        })
    }

    static writeInvidiousProfileToFile(invidiousProfile, filename) {
        writeFileSync(filename, JSON.stringify(invidiousProfile, null, 4));    
    }
}

export class InvidiousCallbackServer {

    constructor(invidiousServer) {
        const callbackServer = this;
        this.port = 55432
        this.tokenPromise = new Promise(function (resolve, reject) {
            callbackServer.tokenResolve = resolve
        })

        const scopes = encodeURIComponent(INVIDIOUS_SCOPES)
        const expire = Date.now() + 60 * 60 * 2;
        const callbackUrl = encodeURIComponent(`http://127.0.0.1:${this.port}/invidious/token_callback`)
        this.authLink = `${invidiousServer}/authorize_token?scopes=${scopes}&callback_url=${callbackUrl}&expire=${expire}`
    }

    async startServer() {
        const callabckServer = this;

        return new Promise(function (resolve, reject) {
            let server = undefined;
            const app = express()
    
            app.get('/invidious/token_callback', (req, res) => {
                if (!req.query.token) {
                    console.warn('No token received on /invidious/token_callback')
                    res.status(400).send('No token received on /invidious/token_callback')
                    return
                }
                callabckServer.token = decodeURIComponent(decodeURIComponent(req.query.token))
                callabckServer.tokenResolve(callabckServer.token)
                res.send("Token received. You can close this window now.")
                server.close()
            })

            server = app.listen(callabckServer.port, () => {
                resolve()
            });    
        })
    }

    async getAccessToken() {
        if (this.token) {
            return this.token
        }

        return this.tokenPromise
    }
}

export class InvidiousInteractive {

    static async getInvidiousInstance() {
        let invidiousServer = '';
        let validServer = false;
        while (!validServer) {
            invidiousServer = await input({
                message: 'Enter Invidious server URL',
                default: '',
                validate: (value) => {
                    if (/^https?:\/\/.*$/.test(value) === false) {
                        return 'Please enter a valid url';
                    }
                    return true;
                },
            });

            if (invidiousServer.endsWith('/')) {
                invidiousServer = invidiousServer.slice(0, -1);
            }

            console.log('Checking server...');
            validServer = await Invidious.pingServer(invidiousServer);
            if (!validServer) {
                const tryAgain = await confirm({ message: 'Failed to communicate with Invidious server. Try again?' });
                if (!tryAgain) {
                    return;
                }
            }
        }

        console.log()
        return invidiousServer;
    }

    static async loginToInvidious(invidiousServer) {
        const callbackServer = new InvidiousCallbackServer(invidiousServer);
        await callbackServer.startServer();

        console.log(`Go to ${callbackServer.authLink} in your browser and authenticate.`);
        const openBrowserAnswer = await confirm({ message: 'Open url in the browser now?' });
        if (openBrowserAnswer) {
            open(callbackServer.authLink);
        }
        console.log()

        const accessToken = await callbackServer.getAccessToken();
        return accessToken;
    }
}