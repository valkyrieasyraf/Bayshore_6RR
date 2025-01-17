import e, { Application } from "express";
import { Module } from "module";
import { Config } from "../config";
import { prisma } from "..";
import path from 'path';

// Import Proto
import * as wm from "../wmmt/wm.proto";
import * as wmsrv from "../wmmt/service.proto";

// Import Util
import * as common from "../util/common";


export default class ResourceModule extends Module {
    register(app: Application): void {

        // Place List
        app.get('/resource/place_list', async (req, res) => {

            console.log('place list');

            // Empty list of place records
            let places: wm.wm.protobuf.Place[] = [];

            // Response data
            places.push(new wm.wm.protobuf.Place({
                placeId: Config.getConfig().placeId || 'JPN01234',
                regionId: Number(Config.getConfig().regionId) || 1,
                shopName: Config.getConfig().shopName || 'Bayshore 6RR',
                country: Config.getConfig().country || 'JPN'
            }));

            let checkPlaceList = await prisma.placeList.findFirst({
                where:{
                    placeId: Config.getConfig().placeId,
                }
            })

            if(!(checkPlaceList))
            {
                console.log('Creating new Place List entry')

                await prisma.placeList.create({
                    data:{
                        placeId: Config.getConfig().placeId || 'JPN01234',
                        regionId: Number(Config.getConfig().regionId) || 1,
                        shopName: Config.getConfig().shopName || 'Bayshore 6RR',
                        country: Config.getConfig().country || 'JPN'
                    }
                })
            }

            // Encode the response
            let message = wm.wm.protobuf.PlaceList.encode({places});

             // Send the response to the client
             common.sendResponse(message, res);
        })


        // Get Ranking data for attract screen (TA, Ghost, VS)
        app.get('/resource/ranking', async (req, res) => {

            console.log('ranking');
            
            // Empty list of all ranking records (Combination of TA, VS Stars, and Ghost Battle Win)
            let lists: wmsrv.wm.protobuf.Ranking.List[] = [];

            // Get TA Ranking
            for(let i=0; i<25; i++){ // GID_TACOURSE ID

                // Get the TA time per course
                let ta_time = await prisma.timeAttackRecord.findMany({ 
                    where: {
                        course: i
                    },
                    orderBy: {
                        time: 'asc'
                    },
                    take: 10,  // Take top 10
                });

                // TA time record by user is available for certain course
                if(ta_time.length > 0){ 

                    // Empty list of ranking records for user time attack
                    let list_ta: wmsrv.wm.protobuf.Ranking.Entry[] = []; 

                    // Get the TA time data
                    for(let j=0; j<ta_time.length; j++){ 

                        // Get the car data
                        let car_ta = await prisma.car.findFirst({ 
                            where: {
                                carId: ta_time[j].carId
                            }
                        });

                        // Push the data to the ranking data
                        list_ta.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                            carId: ta_time[j].carId,
                            rank: car_ta!.level,
                            result: ta_time[j].time,
                            name: car_ta!.name,
                            regionId: car_ta!.regionId,
                            model: car_ta!.model,
                            visualModel: car_ta!.visualModel,
                            defaultColor: car_ta!.defaultColor,
                            tunePower: ta_time[j].tunePower, // Set the tunePower used when playing TA
                            tuneHandling: ta_time[j].tuneHandling, // Set the tuneHandling used when playing TA
                            title: car_ta!.title,
                            level: car_ta!.level
                         }));
                    }

                    // If the TA time record by user is less than 10 user
                    if(ta_time.length < 11){ 

                        // Take the remaining unfilled
                        for(let j=ta_time.length; j<11; j++){ 
                            let resultTime = 599999; // 9:59:999 time

                            // GID_TACOURSE_TOKYOALL & GID_TACOURSE_KANAGAWAALL area
                            if(i === 22 || i === 23){ 
                                resultTime = 1199999; // 19:59:999 time
                            }

                            // Push the data to the ranking data
                            list_ta.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                                carId: 0,
                                rank: 0,
                                result: resultTime,
                                name: 'ＧＵＥＳＴ',
                                regionId: 1, // Hokkaido
                                model: Math.floor(Math.random() * 50), // Randomizing ＧＵＥＳＴ Car data
                                visualModel: Math.floor(Math.random() * 100), // Randomizing ＧＵＥＳＴ Car data
                                defaultColor: 0,
                                tunePower: 0,
                                tuneHandling: 0,
                                title: 'Wangan Beginner', // 湾岸の新人
                                level: 0 // N
                            }));
                        }
                    }
    
                    lists.push(new wmsrv.wm.protobuf.Ranking.List({
                        rankingType: i, // RANKING_TA_*AREA*
                        topRecords: list_ta
                    }));
                }
                // There is no user's TA record for certain area
                else{ 

                    // Empty list of ranking records for ＧＵＥＳＴ time attack
                    let list_ta: wmsrv.wm.protobuf.Ranking.Entry[] = []; 

                    // Generate the top 10 ＧＵＥＳＴ TA time data
                    for(let j=0; j<11; j++){ 
                        let resulttime = 599999; // 9:59:999 time

                        // GID_TACOURSE_TOKYOALL & GID_TACOURSE_KANAGAWAALL area
                        if(i === 22 || i === 23){ 
                            resulttime = 1199999 // 19:59:999 time
                        }

                        // Push the ＧＵＥＳＴ data to the ranking data
                        list_ta.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                            carId: 0,
                            rank: 0,
                            result: resulttime,
                            name: 'ＧＵＥＳＴ',
                            regionId: 1, // Hokkaido
                            model: Math.floor(Math.random() * 50), // Randomizing ＧＵＥＳＴ Car data
                            visualModel: Math.floor(Math.random() * 100), // Randomizing ＧＵＥＳＴ Car data
                            defaultColor: 0,
                            tunePower: 0,
                            tuneHandling: 0,
                            title: 'Wangan Beginner', // 湾岸の新人
                            level: 0 // N
                        }));
                    }

                    // Push the certain area ranking data to the list
                    lists.push(new wmsrv.wm.protobuf.Ranking.List({ 
                        rankingType: i, // RANKING_TA_*AREA*
                        topRecords: list_ta // Top 10 TA time record data
                    }));
                }
            }


            // Get VS Star Ranking
            // Get the user's VS Stars data
            let car_vs = await prisma.car.findMany({ 
                orderBy: {
					vsStarCount: 'desc'
				},
                take: 20, // Take top 20
            });

            // Empty list of ranking records for VS Stars
            let list_vs: wmsrv.wm.protobuf.Ranking.Entry[] = []; 

            // Get the VS stars data
            for(let i=0; i<car_vs.length; i++){ 

                // Push the car data to the ranking data
                list_vs.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                    carId: car_vs[i].carId,
                    rank: car_vs[i].level,
                    result: car_vs[i].vsStarCount,
                    name: car_vs[i].name,
                    regionId: car_vs[i].regionId,
                    model: car_vs[i].model,
                    visualModel: car_vs[i].visualModel,
                    defaultColor: car_vs[i].defaultColor,
                    tunePower: car_vs[i].tunePower,
                    tuneHandling: car_vs[i].tuneHandling,
                    title: car_vs[i].title,
                    level: car_vs[i].level
                 }));
            }

            // If the VS stars record by user is less than 20 user
            if(car_vs.length < 20){ 

                // Take the remaining unfilled
                for(let j=car_vs.length; j<21; j++){ 

                    // Push the ＧＵＥＳＴ data to the ranking data
                    list_vs.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                        carId: 0,
                        rank: 0,
                        result: 0,
                        name: 'ＧＵＥＳＴ',
                        regionId: 1, // Hokkaido
                        model: Math.floor(Math.random() * 50), // Randomizing ＧＵＥＳＴ Car data
                        visualModel: Math.floor(Math.random() * 100), // Randomizing ＧＵＥＳＴ Car data
                        defaultColor: 0,
                        tunePower: 0,
                        tuneHandling: 0,
                        title: 'Wangan Beginner', // 湾岸の新人
                        level: 0 // N
                    }));
                }
            }

            // Push the data
            lists.push(new wmsrv.wm.protobuf.Ranking.List({
                rankingType: 100, // RANKING_VS_STAR
                topRecords: list_vs // Top 20 VS stars record data
            }));

            
            // Get Ghost Defeated Ranking
            // Get the user's Ghost Win data
            let car_ghost = await prisma.car.findMany({ 
                orderBy: {
					rgWinCount: 'desc'
				},
                take: 20, // Take top 20
            });

            // Empty list of ranking records for Ghost Battle Win
            let list_ghost: wmsrv.wm.protobuf.Ranking.Entry[] = []; 

            // Get the Ghost Battle Win data
            for(let i=0; i<car_ghost.length; i++){ 

                // Push the car data to the ranking data
                list_ghost.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                    carId: car_ghost[i].carId,
                    rank: car_ghost[i].level,
                    result: car_ghost[i].rgWinCount,
                    name: car_ghost[i].name,
                    regionId: car_ghost[i].regionId,
                    model: car_ghost[i].model,
                    visualModel: car_ghost[i].visualModel,
                    defaultColor: car_ghost[i].defaultColor,
                    tunePower: car_ghost[i].tunePower,
                    tuneHandling: car_ghost[i].tuneHandling,
                    title: car_ghost[i].title,
                    level: car_ghost[i].level
                 }));
            }

            // If the Ghost Win record by user is less than 20 user
            if(car_ghost.length < 20){ 

                // Take the remaining unfilled
                for(let j=car_ghost.length; j<21; j++){ 

                    // Push the ＧＵＥＳＴ data to the ranking data
                    list_ghost.push(wmsrv.wm.protobuf.Ranking.Entry.create({ 
                        carId: 0,
                        rank: 0,
                        result: 0,
                        name: 'ＧＵＥＳＴ',
                        regionId: 1, // Hokkaido
                        model: Math.floor(Math.random() * 50), // Randomizing ＧＵＥＳＴ Car data
                        visualModel: Math.floor(Math.random() * 100), // Randomizing ＧＵＥＳＴ Car data
                        defaultColor: 0,
                        tunePower: 0,
                        tuneHandling: 0,
                        title: 'Wangan Beginner', // 湾岸の新人
                        level: 0 // N
                    }));
                }
            }

            // Push the data
            lists.push(new wmsrv.wm.protobuf.Ranking.List({
                rankingType: 101, // RANKING_GHOST_DEFEATED_COUNT
                topRecords: list_ghost // Top 20 Ghost Win record data
            }));
            
            // Encode the response
			let message = wmsrv.wm.protobuf.Ranking.encode({lists});

            // Send the response to the client
            common.sendResponse(message, res);
        })


        // Crown List for attract screen and Crown Ghost Battle mode
        app.get('/resource/crown_list', async (req, res) => {

            console.log('crown_list');

            // Empty list of crown records
            let list_crown: wmsrv.wm.protobuf.Crown[] = []; 

            // Get the crown holder data
            let car_crown = await prisma.carCrown.findMany({ 
                orderBy: {
                    area: 'asc'
                },
                distinct: ['area']
            });
            
            // Crown holder data available
            if(car_crown.length !== 0)
            { 
                let counter = 0;  

                // Loop GID_RUNAREA
                for(let i=0; i<19; i++)
                { 
                    // After Kobe is Hiroshima then Fukuoka and the rest
                    if(i > 14)
                    { 
                        i = 18; // GID_RUNAREA_HIROSHIMA
                    }

                    // Crown holder for certain area available
                    if(car_crown[counter].area === i)
                    { 
                        // Get user's data
                        let car = await prisma.car.findFirst({
                            where: {
                                carId: car_crown[counter].carId
                            },
                            include: {
                                gtWing: true,
                                lastPlayedPlace: true
                            }
                        });

                        // Set the tunePower and tuneHandling used when capturing ghost crown
                        car!.tunePower = car_crown[counter].tunePower; 
                        car!.tuneHandling = car_crown[counter].tuneHandling; 

                        // Error handling if played At timestamp value is current date and timestamp is bigger than 9 July 2022 (using GMT+7 timestamp)
                        if(car_crown[counter].playedAt !== 0 && car_crown[counter].playedAt >= 1657299600)
                        {
                            // Acquired crown timestamp - 1 day
                            car!.lastPlayedAt = car_crown[counter].playedAt - 172800;

                            // Acquired crown timestamp - 1 day
                            car_crown[counter].playedAt = car_crown[counter].playedAt - 172800;
                        }
                        // Error handling if played At timestamp value is 0 or timestamp is less than 9 July 2022 (using GMT+7 timestamp)
                        else if(car_crown[counter].playedAt === 0 || car_crown[counter].playedAt < 1657299600)
                        {
                            // Acquired crown timestamp become 9 July 2022 (using GMT+7 timestamp)
                            car!.lastPlayedAt = 1657299600;

                            // Acquired crown timestamp become 9 July 2022 (using GMT+7 timestamp)
                            car_crown[counter].playedAt = 1657299600;
                        }

                        // Push the car data to the crown holder data
                        // GID_RUNAREA_HIROSHIMA
                        if(car_crown[counter].area === 18)
                        {
                            let listCrown = wmsrv.wm.protobuf.Crown.create({  
                                carId: car_crown[counter].carId,
                                area: car_crown[counter].area,
                                unlockAt: car_crown[counter].playedAt,
                                car: car!
                            });

                            list_crown.splice(11, 0, listCrown);
                        }
                        // GID_RUNAREA_C1 - GID_RUNAREA_TURNPIKE
                        else
                        {
                            list_crown.push(wmsrv.wm.protobuf.Crown.create({  
                                carId: car_crown[counter].carId,
                                area: car_crown[counter].area,
                                unlockAt: car_crown[counter].playedAt,
                                car: car!
                            }));
                        }
                        

                        if(counter < car_crown.length-1)
                        {
                            counter++;
                        }
                    }
                    // Crown holder for certain area not available
                    else
                    { 
                        // Push the default data by the game to the crown holder data
                        // GID_RUNAREA_HIROSHIMA
                        if(i === 18)
                        {
                            let listCrown = wmsrv.wm.protobuf.Crown.create({  
                                carId: 999999999-i,
                                area: i,
                                unlockAt: 0,
                            });

                            list_crown.splice(11, 0, listCrown);
                        }
                        // GID_RUNAREA_C1 - GID_RUNAREA_TURNPIKE
                        else
                        {
                            list_crown.push(wmsrv.wm.protobuf.Crown.create({ 
                                carId: 999999999-i,
                                area: i,
                                unlockAt: 0,
                            }));
                        }
                    }
                }
            }
            // There is no user's crown holder data available
            else
            {
                // Loop GID_RUNAREA
                for(let i=0; i<19; i++)
                { 
                    // After Kobe is Hiroshima then Fukuoka and the rest
                    if(i > 14)
                    { 
                        i = 18; // GID_RUNAREA_HIROSHIMA
                    }

                    // Push the default data by the game to the crown holder data
                    // GID_RUNAREA_HIROSHIMA
                    if(i === 18)
                    {
                        let listCrown = wmsrv.wm.protobuf.Crown.create({  
                            carId: 999999999-i,
                            area: i,
                            unlockAt: 0,
                        });

                        // Push it after Kobe
                        list_crown.splice(11, 0, listCrown);
                    }
                    // GID_RUNAREA_C1 - GID_RUNAREA_TURNPIKE
                    else
                    {
                        list_crown.push(wmsrv.wm.protobuf.Crown.create({ 
                            carId: 999999999-i,
                            area: i,
                            unlockAt: 0,
                        }));
                    }
                }
            }  

            // Response data
            let msg = {
                crowns: list_crown
            };

            // Encode the response
            let message = wmsrv.wm.protobuf.CrownList.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
        })


        // For File List
        app.get('/static/:filename', async function(req, res){
            
            // Static Files
            let paths = await prisma.fileList.findFirst({
                where:{
                    urlFileName: req.params.filename
                },
                select: {
                    filePath: true
                }
            });

            
            res.sendFile(path.resolve(paths!.filePath, req.params.filename), { cacheControl: false });
        });


        // File List
        app.get('/resource/file_list', async (req, res) => {

            console.log('file_list');

            // TODO: Actual stuff here
            // This is literally just bare-bones so the shit boots
            let files: wm.wm.protobuf.FileList.FileInfo[] = [];

            let fileList = await prisma.fileList.findMany({
                orderBy:{
                    fileId: 'asc'
                }
            });

            for(let i=0; i<fileList.length; i++)
            {
                files.push(wm.wm.protobuf.FileList.FileInfo.create({
                    fileId: fileList[i].fileId,
                    fileType: fileList[i].fileType,
                    fileSize: fileList[i].fileSize,
                    url: 'https://'+Config.getConfig().serverIp+':9002/static/' +fileList[i].urlFileName,
                    sha1sum: Buffer.from(fileList[i].sha1sum, "hex"),
                    notBefore: fileList[i].notBefore,
                    notAfter: fileList[i].notAfter,
                }));
            }
            

			// Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
                files: files,
                interval: 2
			}

			// Encode the response
			let message = wm.wm.protobuf.FileList.encode(msg);

			// Send the response to the client
            common.sendResponse(message, res);
		})

        
        // Ghost List
        app.get('/resource/ghost_list', async (req, res) => {

            console.log('ghost_list');

            // TODO: Actual stuff here
            // This is literally just bare-bones so the shit boots

			// Response data
            let msg = {
				error: wmsrv.wm.protobuf.ErrorCode.ERR_SUCCESS,
                ghosts: null
			};

            // Encode the response
			let message = wmsrv.wm.protobuf.GhostList.encode(msg);

			// Send the response to the client
            common.sendResponse(message, res);
		})


        // Ghost Expedition (VSORG) Ranking
        app.get('/resource/ghost_expedition_ranking', async (req, res) => {	

            console.log('ghost_expedition_ranking');

            let ghostExpeditionRankings: wm.wm.protobuf.GhostExpeditionRankingEntry[] = [];

            // Get VSORG / Expedition Participant Ranking
            let localScores = await prisma.ghostExpedition.findMany({
                where:{
                    ghostExpeditionId: Number(req.query.ghost_expedition_id)
                },
                orderBy:{
                    score: 'desc'
                }
            })

            // Get car score
            let car;
            let todaysMvps;
            for(let i=0; i<localScores.length; i++)
            {
                car = await prisma.car.findFirst({
                    where:{
                        carId: localScores[i].carId
                    },
                    orderBy:{
                        carId: 'asc'
                    },
                    include:{
                        gtWing: true,
                        lastPlayedPlace: true
                    }
                });

                
                if(car)
                {    
                    ghostExpeditionRankings.push(wm.wm.protobuf.GhostExpeditionRankingEntry.create({
                        rank: i+1,
                        score: localScores[i].score,
                        car: car!
                    }));

                    if(i === 0)
                    {
                        todaysMvps = wm.wm.protobuf.GhostExpeditionRankingEntry.create({
                            rank: i+1,
                            score: localScores[i].score,
                            car: car!
                        });
                    }
                }
            }   

            // Totaling score for store score
            let sum = 0;
            for(let i=0; i<localScores.length; i++)
            {
                sum += localScores[i].score;
            }

            // Response data
            let msg = {
                localScore: sum,
                todaysMvp: todaysMvps || null,
                localRanking: ghostExpeditionRankings || null
            };

            // Encode the response
			let message = wm.wm.protobuf.GhostExpeditionRanking.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
        })


        // Lock Wanted List
        app.get('/resource/lock_wanted_list', async (req, res) => {

            console.log('lock_wanted_list');

            let wanteds: wmsrv.wm.protobuf.WantedCar[] = [];

            // TODO: Actual stuff here
            // This is literally just bare-bones so the shit boots

            // Get the current date/time (unix epoch)
			let date = Math.floor(new Date().getTime() / 1000);

            // Get VSORG Event Date
            let ghostExpeditionDate = await prisma.ghostExpeditionEvent.findFirst({
                where: {
					// qualifyingPeriodStartAt is less than equal current date
					startAt: { lte: date },
		
					// competitionEndAt is greater than equal current date
					aftereventEndAt: { gte: date },
				},
            });

            // Check Wanted Car
            let wantedCarList = await prisma.ghostExpeditionWantedCar.findMany({
                where:{
                    ghostExpeditionId: ghostExpeditionDate?.ghostExpeditionId,
                    locked: true
                }
            });

            // Wanted Car Exists
            if(wantedCarList.length > 0)
            {
                for(let i=0; i<wantedCarList.length; i++)
                {
                    let wantedCar = await prisma.car.findFirst({
                        where:{
                            carId: wantedCarList[i].carId
                        }
                    });

                    let ghostcar = wm.wm.protobuf.GhostCar.create({
                        car: wantedCar!,
                        area: wantedCarList[i].area,
                    });

                    wanteds.push(wm.wm.protobuf.WantedCar.create({
                        ghost: ghostcar,
                        wantedId: wantedCarList[i].carId,
                        bonus: wantedCarList[i].bonus,
                        numOfHostages: wantedCarList[i].numOfHostages
                    }))
                }
            }

            // Encode the response
			let message = wmsrv.wm.protobuf.LockWantedList.encode({wanteds});

            // Send the response to the client
            common.sendResponse(message, res);
        })


        // Ghost Expedition Participants
        app.get('/resource/ghost_expedition_participants', async (req, res) => {

            console.log('ghost_expedition_participants');

            // Get url query
            let ghost_expedition_id = Number(req.query.ghost_expedition_id);
            let place_id = String(req.query.place_id);

            // Get local store participant
            let localParticipant = await prisma.ghostExpedition.findMany({
                where:{
                    ghostExpeditionId: ghost_expedition_id
                },
                orderBy:{
                    score: 'desc'
                }
            })

            let arrayParticipant = [];
            for(let i=0; i<localParticipant.length; i++)
            {
                arrayParticipant.push(localParticipant[i].carId);
            }

            // Response data
            let msg = {
                placeId: place_id,
                participantCars: arrayParticipant
            };

            // Encode the response
			let message = wm.wm.protobuf.GhostExpeditionParticipants.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
        })
    }
}
