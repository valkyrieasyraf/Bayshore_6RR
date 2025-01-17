import bodyParser from "body-parser";
import { Application } from "express";
import { prisma } from ".";
import { unzipSync } from "zlib";
import { Module } from "./module";
import iconv from "iconv-lite";
import { Config } from "./config";
import * as common from "./modules/util/common";

const cors = require('cors');
const fs = require('fs');
const path = require('path');

// TODO: Move this into the config
const STARTUP_URI = `https://${Config.getConfig().serverIp || "localhost"}:9002`;
const STARTUP_HOST = `${Config.getConfig().serverIp || "localhost"}:9002`;

export default class AllnetModule extends Module {
    register(app: Application): void {
        app.use(bodyParser.raw({
            type: '*/*',
            limit: '50mb' // idk.. i got PayloadTooLargeError: request entity too large (adding this solve the problem)
        }));

        app.use(express.json({
            type: '*/*',
            limit: '50mb' // idk.. i got PayloadTooLargeError: request entity too large (adding this solve the problem)
        }));


        app.use(cors({
            origin: '*'
        }));



        app.use("/sys/servlet/PowerOn", function(req, res, next) {
            console.log('amauthd');

            if (req.method !== "POST") {
                return res.status(405).end();
            }
        
            if (!req.is("application/x-www-form-urlencoded")) {
                return next();
            }
        
            const base64 = req.body.toString('ascii');
            const zbytes = Buffer.from(base64, "base64");
            const bytes = unzipSync(zbytes);
            const str = bytes.toString("ascii").trim();
        
            const kvps = str.split("&");
            const reqParams: any = {};
        
            // Keys and values are not URL-escaped
        
            kvps.forEach(kvp => {
                const [key, val] = kvp.split("=");
        
                reqParams[key] = val;
            });
        
            const send_ = res.send;
        
            req.body = reqParams;
            res.send = resParams => {
                const str =
                    Object.entries(resParams)
                        .map(([key, val]) => key + "=" + val)
                        .join("&") + "\n";
        
                res.set("content-type", "text/plain");
        
                const bin = iconv.encode(str, "shift_jis");
        
                return send_.apply(res, [bin]);
            };
        
            return next();
        });
        
        app.post("/sys/servlet/PowerOn", function(req, res) {
            console.log('ALL.net: Startup request');
            
            // Cut milliseconds out of ISO timestamp
        
            const now = new Date();
            const adjusted = now;

            let shopName = Config.getConfig().shopName;
            let shopNick = Config.getConfig().shopNickname;
            let regionName = Config.getConfig().regionName;
            let placeId = Config.getConfig().placeId;
            let country = Config.getConfig().country;
            let regionId = Config.getConfig().regionId;

            // TODO: Implement board authentication here.
        
            const resParams = {
                stat: 1,
                uri: STARTUP_URI,
                host: STARTUP_HOST,
                place_id: placeId,
                name: shopName,
                nickname: shopNick,
                region0: regionId,
                region_name0: regionName,
                region_name1: "X",
                region_name2: "Y",
                region_name3: "Z",
                country: country,
                allnet_id: "456",
                timezone: "002:00",
                setting: "",
                year: adjusted.getFullYear(),
                month: adjusted.getMonth() + 1, // I hate JS
                day: adjusted.getDate(),
                hour: adjusted.getHours(),
                minute: adjusted.getMinutes(),
                second: adjusted.getSeconds(),
                res_class: "PowerOnResponseVer2",
                token: req.body.token,
            };
                
            res.send(resParams);
        });

        
        // -----------------------------WEBSITE STUFF-----------------------------
        /*let website = Config.getConfig().website || 0;
        if(website === 1)
        {
            // -------------------------------HTML STUFF-------------------------------
            // Index HTML
            app.get("/", function(req, res) {

                // Send the HTML File
                res.sendFile(path.resolve('public_html/index.html'));
            });


            // Download HTML
            app.get("/download", function(req, res) {

                // Send the HTML File
                res.sendFile(path.resolve('public_html/download.html'));
            });


            // Ranking TA HTML
            app.get("/ranking_ta", function(req, res) {

                // Send the HTML File
                res.sendFile(path.resolve('public_html/ranking_ta.html'));
            });


            // Ranking OCM HTML
            app.get("/ranking_ocm", function(req, res) {

                // Send the HTML File
                res.sendFile(path.resolve('public_html/ranking_ocm.html'));
            });


            // Crown Holder HTML
            app.get("/crown_holder", function(req, res) {

                // Send the HTML File
                res.sendFile(path.resolve('public_html/crown_holder.html'));
            });


            // News HTML
            app.get("/news/:id", function(req, res) {

                // Get Request Parameter
                let id = req.params.id;

                // Send the HTML File
                res.sendFile(path.resolve('public_html/news/' +id+ '.html'));
            });


            // -------------------------------API STUFF--------------------------------
            // GET Ranking TA
            app.get('/api/ranking_ta', async (req, res) => {

                // Get the request body
                let query = req.query;

                // Message Response
                let message: any = {
                    error: null,
                    user: null
                };

                try
                {
                    // Get the record from the database
                    let user = await prisma.timeAttackRecord.findMany({
                        where:{
                            course: Number(query.course)
                        },
                        include:{
                            car: {
                                select:{
                                    carId: true,
                                    name: true,
                                    visualModel: true,
                                    regionId: true,
                                    level: true,
                                    defaultColor: true
                                }
                            }
                        },
                        orderBy:{
                            time: 'asc'
                        }
                    });

                    if(user)
                    {
                        message.user = user;
                    }
                    else
                    {
                        message.error = 404
                    }
                }
                catch(e) // Failed to retrieve cars
                {
                    
                }

                // Send the response to the client
                res.send(message);
            });


            // GET Ranking OCM
            app.get('/api/ranking_ocm', async (req, res) => {

                // Get the request body
                let query = req.query;

                // Message Response
                let message: any = {
                    error: null,
                    user: null
                };

                try
                {
                    let getTime = await prisma.oCMEvent.findFirst({
                        where:{
                            competitionId: Number(query.competitionId)
                        },
                    });
                    let date = Math.floor(new Date().getTime() / 1000);

                    if(getTime)
                    {
                        // Get the record from the database
                        let user;

                        // Qualifying Time
                        if(getTime.qualifyingPeriodCloseAt > date && getTime.qualifyingPeriodStartAt < date)
                        {
                            user = await prisma.oCMGhostBattleRecord.findMany({
                                where:{
                                    competitionId: Number(query.competitionId)
                                },
                                include:{
                                    car: {
                                        select:{
                                            carId: true,
                                            name: true,
                                            visualModel: true,
                                            regionId: true,
                                            level: true,
                                            defaultColor: true
                                        }
                                    }
                                },
                                orderBy:{
                                    result: 'desc'
                                }
                            });
                        }
                        // Main Draw and Closed Time
                        else
                        {
                            
                            user = await prisma.oCMTally.findMany({
                                where:{
                                    competitionId: Number(query.competitionId)
                                },
                                include:{
                                    car: {
                                        select:{
                                            carId: true,
                                            name: true,
                                            visualModel: true,
                                            regionId: true,
                                            level: true,
                                            defaultColor: true
                                        }
                                    }
                                },
                                orderBy:{
                                    result: 'desc'
                                }
                            });
                        }
                        

                        if(user)
                        {
                            message.user = user;
                        }
                        else
                        {
                            message.error = 404
                        }
                    }
                    else
                    {
                        message.error = 404
                    }
                }
                catch(e) // Failed to retrieve cars
                {
                    
                }
                
                // Send the response to the client
                res.send(message);
            });


            // GET OCM List
            app.get('/api/ocm_list', async (req, res) => {

                // Message Response
                let message: any = {
                    error: null,
                    competition: null
                };

                try
                {
                    let getOCMList = await prisma.oCMEvent.findMany({
                        orderBy:{
                            competitionId: 'desc'
                        }
                    });

                    if(getOCMList)
                    {
                        message.competition = getOCMList;
                    }
                    else
                    {
                        message.error = 404
                    }
                }
                catch(e) // Failed to retrieve cars
                {
                    
                }

                // Send the response to the client
                res.send(message);
            });


            // GET Ranking OCM
            app.get('/api/crown_holder', async (req, res) => {
                // Message Response
                let message: any = {
                    error: null,
                    data: null
                };

                // Get the data
                try
                {
                    let data = [{ carId: 0, area: [0], name: '', visualModel: 0, defaultColor: 0 }];
                    data = await prisma.$queryRaw`
                    SELECT "CarCrown"."carId", "Car"."name", "Car"."visualModel", "Car"."defaultColor" FROM "CarCrown" JOIN "Car" ON "CarCrown"."carId" = "Car"."carId" GROUP BY "CarCrown"."carId", "Car"."name", "Car"."visualModel", "Car"."defaultColor" ORDER BY MIN(array_position(array[0,1,2,3,4,5,6,7,8,9,10,18,11,12,13], "CarCrown"."area"))`;

                    if (data.length > 0)
                    {
                        for(let i=0; i<data.length; i++)
                        {
                            let userCar = await prisma.carCrown.findMany({
                                where: {
                                    carId: data[i].carId
                                },
                                select:{
                                    area: true
                                },
                                orderBy:{
                                    area: 'asc'
                                }
                            });
                            let array = [];

                            for(let j=0; j<userCar.length; j++)
                            {
                                array.push(userCar[j].area);
                            }
                            
                            data[i].area = array;
                        }

                        message.data = data;
                    }
                }
                catch(e) // Failed to retrieve cars
                {
                    
                }

                // Send the response to the client
                res.send(message);
            });


            // GET News Image
            app.get('/news/assets/:fileName', async (req, res) => {
                
                // Get Request Parameter
                let fileName = req.params.fileName;
                let fullPath = path.resolve('public_html/news/assets/' +fileName);

                // CSS
                if(fileName.includes('png') ||
                        fileName.includes('gif') ||
                        fileName.includes('jpg') ||
                        fileName.includes('jpeg') ||
                        fileName.includes('ico') )
                {
                    try
                    {
                        if(fs.existsSync(fullPath))
                        {
                            let format = fileName.split(".");
                            res.writeHead(200, {'Content-Type': 'image/'+format[format.length-1] });

                            fs.createReadStream(fullPath).pipe(res);
                        }
                        else
                        {
                            // Message Response
                            let message: any = {
                                error: 404,
                            };

                            // Send the response to the client
                            res.send(message);
                        }
                    }
                    catch(e) // Failed to retrieve cars
                    {
                        // Message Response
                        let message: any = {
                            error: 404,
                        };

                        // Send the response to the client
                        res.send(message);
                    }
                }
                // Just Send It
                else
                {
                    // Message Response
                    let message: any = {
                        error: 404,
                    };

                    // Send the response to the client
                    res.send(message);
                }
            });


            // GET Visual Model Image
            app.get('/assets/:folderName/:fileName', async (req, res) => {
                
                // Get Request Parameter
                let folderName = req.params.folderName;
                let fileName = req.params.fileName;
                let fullPath = path.resolve('public_html/assets/' +folderName+ '/' +fileName);

                // CSS
                if(folderName.includes('css') || folderName.includes('js'))
                {
                    try
                    {
                        if(fs.existsSync(fullPath))
                        {
                            res.sendFile(fullPath);
                        }
                    }
                    catch(e) // Failed to retrieve cars
                    {
                        
                    }
                }
                // PNG assets
                else if(fileName.includes('png') ||
                        fileName.includes('gif') ||
                        fileName.includes('jpg') ||
                        fileName.includes('jpeg') ||
                        fileName.includes('ico') )
                {
                    try
                    {
                        if(fileName == '56.png')
                        {
                            fileName = '56_2.png';
                        }

                        if(fs.existsSync(fullPath))
                        {
                            let format = fileName.split(".");
                            res.writeHead(200, {'Content-Type': 'image/'+format[format.length-1] });

                            fs.createReadStream(fullPath).pipe(res);
                        }
                        else
                        {
                            // Message Response
                            let message: any = {
                                error: 404,
                            };

                            // Send the response to the client
                            res.send(message);
                        }
                    }
                    catch(e) // Failed to retrieve cars
                    {
                        // Message Response
                        let message: any = {
                            error: 404,
                        };

                        // Send the response to the client
                        res.send(message);
                    }
                }
                // Just Send It
                else
                {
                    // Message Response
                    let message: any = {
                        error: 404,
                    };

                    // Send the response to the client
                    res.send(message);
                }
            });
        }
    }
}*/
