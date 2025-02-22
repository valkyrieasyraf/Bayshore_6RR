import express, { Application } from "express";
import { prisma } from ".";
import { Module } from "./module";
import axios from "axios"; // For making HTTP requests to Discord webhook

export default class ApiModule extends Module {
    private discordWebhookUrl: string = "YOUR_DISCORD_WEBHOOK_URL"; // Replace with your Discord webhook URL

    register(app: Application): void {
        app.use(express.urlencoded({
            type: '*/*',
            extended: true
        }));

        app.use(express.json({
            type: '*/*'
        }));

        // API Get Requests
        // Get Current Bayshore Version
        app.get('/api/bayshore_version', async (req, res) => {
            let message: any = {
                error: null,
                version: null
            };

            let myJSON = '{' +
                '"version": "v1.0.0",' +
                '"log":' +
                '[' +
                '"• Fix ghost play count when retiring ocm",' +
                '"• API for ocm ranking",' +
                '"• Fix unlimited ghost stamp return (hopefully no more of this)",' +
                '"• Fix give meter reward bug if playCount still 0",' +
                '"• Hopefully fix ocm HoF bug"' +
                '"• Fix duplicate id in carOrder"' +
                '"• Fix OCM HoF wrong shopName"' +
                ']' +
                '}';
            message.version = JSON.parse(myJSON);

            // Send the response to the client
            res.send(message);
        });

        // Post Login
        app.post('/api/login', async (req, res) => {
            let query = req.query;
            let message: any = {
                error: null,
                user: null
            };

            let user = await prisma.user.findFirst({
                where: {
                    chipId: {
                        startsWith: query.cardChipId?.toString()
                    },
                    accessCode: query.accessCode?.toString()
                },
                include: {
                    cars: {
                        select: {
                            state: true,
                            gtWing: true,
                            lastPlayedPlace: true,
                            carId: true,
                            name: true,
                            defaultColor: true,
                            visualModel: true,
                            level: true,
                            title: true,
                            regionId: true,
                        }
                    }
                }
            });

            if (user) {
                message.user = user;
            } else {
                message.error = 404;
            }

            res.send(message);
        });

        // Get Current Competition Id
        app.get('/api/get_competition_id', async (req, res) => {
            let date = Math.floor(new Date().getTime() / 1000);
            let message: any = {
                error: null,
                competitionId: 1 // default
            };

            let ocmEventDate = await prisma.oCMEvent.findFirst({
                where: {
                    qualifyingPeriodStartAt: { lte: date },
                    competitionEndAt: { gte: date },
                },
                orderBy: [
                    {
                        dbId: 'desc'
                    },
                    {
                        competitionEndAt: 'desc',
                    },
                ],
                select: {
                    competitionId: true
                }
            });

            if (ocmEventDate) {
                message.competitionId = ocmEventDate.competitionId;
            } else {
                ocmEventDate = await prisma.oCMEvent.findFirst({
                    orderBy: {
                        dbId: 'desc'
                    },
                    select: {
                        competitionId: true
                    }
                });

                message.competitionId = ocmEventDate!.competitionId;
            }

            res.send(message);
        });

        // Get Current Competition Id for Hall of Fame
        app.get('/api/get_hof_competition_id', async (req, res) => {
            let message: any = {
                error: null,
                competitionId: 1 // default
            };

            let ocmEventDate = await prisma.oCMTally.findFirst({
                where: {
                    periodId: 999999999
                },
                orderBy: {
                    competitionId: 'desc'
                },
                select: {
                    competitionId: true
                }
            });

            if (ocmEventDate) {
                message.competitionId = ocmEventDate.competitionId;
            }

            res.send(message);
        });

        // Get Competition Ranking
        app.get('/api/get_competition_ranking', async (req, res) => {
            let competitionId = Number(req.query.competitionId);
            let message: any = {
                error: null,
                cars: [],
                lastPlayedPlace: 'Bayshore'
            };

            message.cars = await prisma.oCMTally.findMany({
                where: {
                    competitionId: competitionId
                },
                orderBy: {
                    result: 'desc'
                },
                include: {
                    car: {
                        select: {
                            carId: true,
                            name: true,
                            defaultColor: true,
                            visualModel: true,
                            level: true,
                            title: true,
                            regionId: true,
                        }
                    },
                }
            });

            let getLastPlayedPlace = await prisma.oCMGhostBattleRecord.findFirst({
                where: {
                    carId: message.cars[0].carId,
                    competitionId: competitionId
                }
            });

            message.lastPlayedPlace = getLastPlayedPlace?.playedShopName;

            res.send(message);
        });

        // New Endpoint: Send Message to Discord
        app.post('/api/send_discord_message', async (req, res) => {
            const { message } = req.body;

            if (!message) {
                return res.status(400).send({ error: "Message is required" });
            }

            try {
                await axios.post(this.discordWebhookUrl, {
                    content: message
                });

                res.send({ success: true });
            } catch (error) {
                console.error("Failed to send message to Discord:", error);
                res.status(500).send({ error: "Failed to send message to Discord" });
            }
        });

        // New Endpoint: Update User Stats and Notify Discord
        app.post('/api/update_user_stats', async (req, res) => {
            const { userId, stats } = req.body;

            if (!userId || !stats) {
                return res.status(400).send({ error: "UserId and stats are required" });
            }

            try {
                // Update user stats in the database
                const updatedUser = await prisma.user.update({
                    where: { id: userId },
                    data: stats
                });

                // Send a message to Discord
                await axios.post(this.discordWebhookUrl, {
                    content: `User ${updatedUser.name} stats updated: ${JSON.stringify(stats)}`
                });

                res.send({ success: true, user: updatedUser });
            } catch (error) {
                console.error("Failed to update user stats:", error);
                res.status(500).send({ error: "Failed to update user stats" });
            }
        });
    }
}