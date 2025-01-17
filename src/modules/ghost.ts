import { Application } from "express";
import { Module } from "module";
import { prisma } from "..";
import { CarPathandTuning } from "@prisma/client";
import Long from "long";
import { Config } from "../config";

// Import Proto
import * as wm from "../wmmt/wm.proto";
import * as wmsrv from "../wmmt/service.proto";

// Import Util
import * as common from "../util/common";
import * as ghost_save_trail from "../util/ghost/ghost_save_trail";
import * as ghost_trail from "../util/ghost/ghost_trail";
import * as ghost_area from "../util/ghost/ghost_area";
import * as ghost_default_car from "../util/ghost/ghost_default_car";


export default class GhostModule extends Module {
    register(app: Application): void {

        // Load Ghost Battle Info
        app.post('/method/load_ghost_battle_info', async (req, res) => {

			// Get the request body for the load stamp target request
			let body = wm.wm.protobuf.LoadGhostBattleInfoRequest.decode(req.body); 

			let car = await prisma.car.findFirst({
				where:{
					carId: body.carId
				},
				include:{
					gtWing: true,
					lastPlayedPlace: true
				}
			})

			// Car History
			let findChallenger = await prisma.carChallenger.findMany({
				where: {
					challengerCarId: body.carId
				},
				orderBy:{
					lastPlayedAt: 'desc'
				},
				take: 10
			})

			let carsHistory: wm.wm.protobuf.Car[] = [];
			if(findChallenger.length > 0)
			{
				for(let i=0; i<findChallenger.length; i++)
				{
					let car = await prisma.car.findFirst({
						where: {
							carId: findChallenger[i].carId
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						},
						orderBy: {
							carId: 'asc'
						},
						take: 10
					});

					carsHistory.push(wm.wm.protobuf.Car.create({
						...car!
					}))
				}
			}

			let carsStamp: wm.wm.protobuf.StampTargetCar[] = [];
			let carsChallenger: wm.wm.protobuf.ChallengerCar[] = [];

            // Get all of the friend cars for the carId provided
            let stampTargets = await prisma.carStampTarget.findMany({
                where: {
                    stampTargetCarId: body.carId,
					recommended: true
                },
				orderBy:{
					locked: 'desc'
				}
            });

			if(stampTargets)
			{
				for(let i=0; i<stampTargets.length; i++)
				{
					let carTarget = await prisma.car.findFirst({
						where:{
							carId: stampTargets[i].carId
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					})

					carsStamp.push(
						wm.wm.protobuf.StampTargetCar.create({
							car: carTarget!,
							returnCount: stampTargets[i].returnCount, 
							locked: stampTargets[i].locked, 
						})
					);
				}
			}

			// Get all of the challenger car for the carId provided except beated car
			let checkBeatedCar = await prisma.carStampTarget.findMany({
                where: {
                    stampTargetCarId: body.carId,
					recommended: false
                },
				orderBy:{
					carId: 'asc'
				}
            });

			let arrChallengerCarId = [];
			for(let i=0; i<checkBeatedCar.length; i++)
			{
				arrChallengerCarId.push(checkBeatedCar[i].carId);
			}

            let challengers = await prisma.carChallenger.findMany({
                where: {
                    carId: body.carId,
					NOT: {
						challengerCarId: { in: arrChallengerCarId }, // Except beated challenger id
					},
                }
            });

			if(challengers)
			{
				for(let i=0; i<challengers.length; i++)
				{
					let carTarget = await prisma.car.findFirst({
						where:{
							carId: challengers[i].challengerCarId
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					})

					let result = 0;
					if(challengers[i].result > 0)
					{
						result = -Math.abs(challengers[i].result);
					}
					else{
						result = Math.abs(challengers[i].result);
					}

					carsChallenger.push(
						wm.wm.protobuf.ChallengerCar.create({
							car: carTarget!,
							stamp: challengers[i].stamp,
                            result: result, 
                            area: challengers[i].area
						})
					);
				}
			}

            // Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
				stampTargetCars: carsStamp || null,
				challengers: carsChallenger || null,
				stampSheetCount: car!.stampSheetCount,
                stampSheet: car?.stampSheet || null, 
                stampReturnStats: car?.stampSheet || null,
				history: carsHistory || null,
				promotedToBuddy: false,
				acquiredBingoNumbers: car?.acquiredBingoNumbers || null //TODO: Implement Bingo
			};

            // Encode the response
			let message = wm.wm.protobuf.LoadGhostBattleInfoResponse.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
        })


        // Load Stamp Target
		app.post('/method/load_stamp_target', async (req, res) => {

            // Get the request body for the load stamp target request
			let body = wm.wm.protobuf.LoadStampTargetRequest.decode(req.body); 

			let carsStamp: wm.wm.protobuf.StampTargetCar[] = [];
			let carsChallenger: wm.wm.protobuf.ChallengerCar[] = [];

            // Get all of the friend cars for the carId provided
            let stampTargets = await prisma.carStampTarget.findMany({
                where: {
                    stampTargetCarId: body.carId,
					recommended: true
                },
				orderBy:{
					locked: 'asc'
				}
            });

			if(stampTargets)
			{
				for(let i=0; i<stampTargets.length; i++)
				{
					let carTarget = await prisma.car.findFirst({
						where:{
							carId: stampTargets[i].carId
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					})

					carsStamp.push(
						wm.wm.protobuf.StampTargetCar.create({
							car: carTarget!,
							returnCount: stampTargets[i].returnCount, 
							locked: stampTargets[i].locked, 
						})
					);
				}
			}

			// Get all of the friend cars for the carId provided
            let challengers = await prisma.carChallenger.findMany({
                where: {
                    carId: body.carId
                }
            });

			if(stampTargets)
			{
				for(let i=0; i<challengers.length; i++)
				{
					let carTarget = await prisma.car.findFirst({
						where:{
							carId: challengers[i].challengerCarId
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					})

					let result = 0;
					if(challengers[i].result > 0)
					{
						result = -Math.abs(challengers[i].result);
					}
					else{
						result = Math.abs(challengers[i].result);
					}

					carsChallenger.push(
						wm.wm.protobuf.ChallengerCar.create({
							car: carTarget!,
							stamp: challengers[i].stamp,
                            result: result, 
                            area: challengers[i].area
						})
					);
				}
			}

            // Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
				cars: carsStamp,
				challengers: carsChallenger
			};

			// Encode the response
            let message = wm.wm.protobuf.LoadStampTargetResponse.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
		})


        // Ghost Mode
        app.post('/method/search_cars_by_level', async (req, res) => {

            // Get the request body for the search cars by level request
            let body = wm.wm.protobuf.SearchCarsByLevelRequest.decode(req.body);

			let car;

			if(body.regionId !== null && body.regionId !== undefined && body.regionId !== 0)
			{
				// Find ghost car by selected level and region ID
				car = await prisma.car.findMany({
					where: {
						ghostLevel: body.ghostLevel,
						regionId: body.regionId
					},
					include:{
						gtWing: true,
						lastPlayedPlace: true,
					}
				});
			}
			else
			{
				// Find ghost car by selected level
				car = await prisma.car.findMany({
					where: {
						ghostLevel: body.ghostLevel,
					},
					include:{
						gtWing: true,
						lastPlayedPlace: true,
					}
				});
			}

			// Randomizing the starting ramp and path based on selected area
			let rampVal = 0;
			let pathVal = 0;
			
			// Get the ramp and path id
			let ghost_areas = await ghost_area.GhostArea(body.area);

			// Set the value
			rampVal = ghost_areas.rampVal;
			pathVal = ghost_areas.pathVal;

			// Empty list of ghost car records
			let lists_ghostcar: wm.wm.protobuf.GhostCar[] = [];
			let arr = [];
			let maxNumber = 0;

            // If all user car data available is more than 10 for certain level
			if(car.length > 10)
			{ 
				maxNumber = 10 // Limit to 10 (game default)
			}
            // If no more than 10
			else
			{
				maxNumber = car.length;
			}

            // Choose the user's car data randomly to appear
			while(arr.length < maxNumber)
			{ 
                // Pick random car Id
				let randomNumber: number = Math.floor(Math.random() * car.length);
				if(arr.indexOf(randomNumber) === -1){

                    // Push current number to array
					arr.push(randomNumber); 

                    // Check if ghost trail for certain car is available
					let ghost_trails = await prisma.ghostTrail.findFirst({
						where: {
							carId: car[randomNumber].carId,
							area: body.area,
							crownBattle: false
						},
						orderBy: {
							playedAt: 'desc'
						}
					});

                    // If regionId is 0 or not set, game will crash after defeating the ghost
					if(car[randomNumber]!.regionId === 0)
					{ 
						let randomRegionId = Math.floor(Math.random() * 47) + 1;
						car[randomNumber].regionId = randomRegionId;
					}

                    // Push user's car data without ghost trail
					if(!(ghost_trails))
					{ 
						lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
							car: car[randomNumber]
						}));
					}
                    // Push user's car data with ghost trail
					else
					{
                        // Set the tunePower used when playing certain area
						car[randomNumber].tunePower = ghost_trails!.tunePower;

                        // Set the tuneHandling used when playing certain area
						car[randomNumber].tuneHandling = ghost_trails!.tuneHandling;

                        // Push data to Ghost car proto
						lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
							car: car[randomNumber],
							nonhuman: false,
							type: wm.wm.protobuf.GhostType.GHOST_NORMAL,
							trailId: ghost_trails!.dbId!
						}));
					}
				}
			}

			// Check again if car list for that selected region is available of not
			if(body.regionId !== null && body.regionId !== undefined && body.regionId !== 0)
			{
				if(car.length < 1)
				{
					// Get current date
					let date = Math.floor(new Date().getTime() / 1000);
					
					let playedPlace = wm.wm.protobuf.Place.create({ 
						placeId: Config.getConfig().placeId,
						regionId: Config.getConfig().regionId,
						shopName: Config.getConfig().shopName,
						country: Config.getConfig().country
					});

					let tunePowerDefault = 0
					let tuneHandlingDefault = 0;
					if(body.ghostLevel === 1)
					{
						tunePowerDefault = 1;
						tuneHandlingDefault = 4;
					}
					else if(body.ghostLevel === 2)
					{
						tunePowerDefault = 5;
						tuneHandlingDefault = 5;
					}
					else if(body.ghostLevel === 3)
					{
						tunePowerDefault = 8;
						tuneHandlingDefault = 7;
					}
					else if(body.ghostLevel === 4)
					{
						tunePowerDefault = 10;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 5)
					{
						tunePowerDefault = 15;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 6)
					{
						tunePowerDefault = 18;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 7)
					{
						tunePowerDefault = 20;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 8)
					{
						tunePowerDefault = 21;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 9)
					{
						tunePowerDefault = 22;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 10)
					{
						tunePowerDefault = 24;
						tuneHandlingDefault = 10;
					}
					else if(body.ghostLevel === 11)
					{
						tunePowerDefault = 24;
						tuneHandlingDefault = 24;
					}

					// Generate default S660 car data
					let ghost_default_cars = await ghost_default_car.DefaultGhostCarHonda();

					// Push data to Ghost car proto
					lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
						car: {
							...ghost_default_cars.cars,
							regionId: body.regionId,
							tunePower: tunePowerDefault,
							tuneHandling: tuneHandlingDefault,
							lastPlayedAt: date,
							lastPlayedPlace: playedPlace
						},
						nonhuman: true,
						type: wm.wm.protobuf.GhostType.GHOST_DEFAULT,
					}))
				}

				// else{} have car list
			}

            // Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
				ramp: rampVal,
				path: pathVal,
				ghosts: lists_ghostcar,
				selectionMethod: Number(wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_LEVEL)
			};

			// Encode the response
            let message = wm.wm.protobuf.SearchCarsByLevelResponse.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
        })


		app.post('/method/search_cars', async (req, res) => {

			// Get the request body for the load ghost drive data request
            let body = wm.wm.protobuf.SearchCarsRequest.decode(req.body);

			// Find ghost car
			let car;
			switch(body.selectionMethod)
			{
				// GHOST_SELECT_BY_MANUFACTURER = 16
				case wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_MANUFACTURER:
				{
					let selectManufacturer = body.selectManufacturer;

					car = await prisma.car.findMany({
						where:{
							manufacturer: selectManufacturer
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					});

					break;
				}
				// GHOST_SELECT_BY_OTHER_MANUFACTURER = 17
				case wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_OTHER_MANUFACTURER:
				{
					let selectManufacturer = body.selectManufacturer;

					car = await prisma.car.findMany({
						where:{
							manufacturer: selectManufacturer
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					});

					break;
				}
				// GHOST_SELECT_BY_REGION_MANUFACTURER = 20
				case wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_MANUFACTURER:
				{
					let selectManufacturer = body.selectManufacturer;

					car = await prisma.car.findMany({
						where:{
							manufacturer: selectManufacturer
						},
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					});

					break;
				}
				default:
				{
					car = await prisma.car.findMany({
						include:{
							gtWing: true,
							lastPlayedPlace: true
						}
					});

					break;
				}
			}
			// Randomizing the starting ramp and path based on selected area
			let rampVal = 0;
			let pathVal = 0;
			
			// Get the ramp and path id
			let ghost_areas = await ghost_area.GhostArea(body.area);

			// Set the value
			rampVal = ghost_areas.rampVal;
			pathVal = ghost_areas.pathVal;

			// Empty list of ghost car records
			let lists_ghostcar: wm.wm.protobuf.GhostCar[] = [];
			let arr = [];
			let maxNumber = 0;

			if(car.length === 0)
			{
				if(body.selectionMethod === wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_MANUFACTURER ||
				   body.selectionMethod === wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_OTHER_MANUFACTURER || 
				   body.selectionMethod === wm.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_MANUFACTURER)
				{
					// Default car here
					let ghost_default_cars: any;

					if(body.selectManufacturer === 0) // BMW (Blood, Memory, Wonichan Moe)
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarBMW();
					}
					else if(body.selectManufacturer === 1) // CHEVROLET
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarChevrolet();
					}
					else if(body.selectManufacturer === 2) // MAZDA
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarMazda();
					}
					else if(body.selectManufacturer === 3) // MERCEDES BENZ
					{
						// TODO: default car here
						ghost_default_cars = await ghost_default_car.DefaultGhostCarMercedes();
					}
					else if(body.selectManufacturer === 4) // MITSUBISHI
					{
						// TODO: default car here
						ghost_default_cars = await ghost_default_car.DefaultGhostCarMitsubishi();
					}
					else if(body.selectManufacturer === 5) // NISSAN
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarNissan();
					}
					/*else if(body.selectManufacturer === 6) // ???
					{
						// TODO: default car here
						ghost_default_cars = await ghost_default_car.DefaultGhostCar???();
					}*/
					else if(body.selectManufacturer === 7) // SUBARU
					{
						// TODO: default car here
						ghost_default_cars = await ghost_default_car.DefaultGhostCarSubaru();
					}
					else if(body.selectManufacturer === 8) // TOYOTA
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarToyota();
					}
					else if(body.selectManufacturer === 9) // AUDI
					{
						// TODO: default car here
						ghost_default_cars = await ghost_default_car.DefaultGhostCarAudi();
					}
					else if(body.selectManufacturer === 10) // DODGE
					{
						// TODO: default car here
						ghost_default_cars = await ghost_default_car.DefaultGhostCarDodge();
					}
					else if(body.selectManufacturer === 11) // LAMBORGHINI
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarLamborghini();
					}
					else if(body.selectManufacturer === 12) // HONDA
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarHonda();
					}
					else if(body.selectManufacturer === 13) // ACURA
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarAcura();
					}
					else if(body.selectManufacturer === 14) // PORSCHE
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarPorsche();
					}
					else // OTHER MAYBE?
					{
						ghost_default_cars = await ghost_default_car.DefaultGhostCarHonda();
					}

					// Get current date
					let date = Math.floor(new Date().getTime() / 1000);

					let playedPlace = wm.wm.protobuf.Place.create({ 
						placeId: Config.getConfig().placeId,
						regionId: Config.getConfig().regionId,
						shopName: Config.getConfig().shopName,
						country: Config.getConfig().country
					});

					for(let i=0; i<3; i++)
					{

						lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
							car: {
								...ghost_default_cars.cars,
								carId: 999999999-i, // prevent dupilcate id
								lastPlayedAt: date,
								lastPlayedPlace: playedPlace

							},
							area: body.area,
							ramp: rampVal,
							path: pathVal,
							nonhuman: true,
						}))
					}
				}
			}
			else
			{
				// If all user car data available is more than 10 for certain level
				if(car.length > 10)
				{ 
					maxNumber = 10 // Limit to 10 (game default)
				}
				// If no more than 10
				else
				{
					maxNumber = car.length;
				}

				// Choose the user's car data randomly to appear
				while(arr.length < maxNumber)
				{
					// Pick random car Id
					let randomNumber: number = Math.floor(Math.random() * car.length);
					if(arr.indexOf(randomNumber) === -1)
					{
						// Push current number to array
						arr.push(randomNumber); 

						// Check if ghost trail for certain car is available
						let ghost_trails = await prisma.ghostTrail.findFirst({
							where: {
								carId: car[randomNumber].carId,
								area: body.area,
								crownBattle: false
							},
							orderBy: {
								playedAt: 'desc'
							}
						});

						// If regionId is 0 or not set, game will crash after defeating the ghost
						if(car[randomNumber]!.regionId === 0)
						{ 
							let randomRegionId = Math.floor(Math.random() * 47) + 1;
							car[randomNumber].regionId = randomRegionId;
						}

						// Push user's car data without ghost trail
						if(!(ghost_trails))
						{ 
							lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
								car: car[randomNumber],
								area: body.area,
								ramp: rampVal,
								path: pathVal,
								nonhuman: true,
								type: wm.wm.protobuf.GhostType.GHOST_DEFAULT,					
							}));
						}
						// Push user's car data with ghost trail
						else
						{
							// Set the tunePower used when playing certain area
							car[randomNumber].tunePower = ghost_trails!.tunePower;

							// Set the tuneHandling used when playing certain area
							car[randomNumber].tuneHandling = ghost_trails!.tuneHandling;

							// Push data to Ghost car proto
							lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
								car: car[randomNumber],
								area: body.area,
								ramp: rampVal,
								path: pathVal,
								nonhuman: false,
								type: wm.wm.protobuf.GhostType.GHOST_NORMAL,
								trailId: ghost_trails!.dbId!
							}));
						}
					}
				}
			}

			// Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
				ramp: rampVal,
				path: pathVal,
				ghosts: lists_ghostcar,
				selectionMethod: wm.wm.protobuf.PathSelectionMethod.PATH_NORMAL
			};

			// Encode the response
            let message = wm.wm.protobuf.SearchCarsResponse.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
		})


        // Load Normal Ghost Trail data
        app.post('/method/load_ghost_drive_data', async (req, res) => {

            // Get the request body for the load ghost drive data request
            let body = wm.wm.protobuf.LoadGhostDriveDataRequest.decode(req.body);

            // Get the path value from request body
			let path = body.path;

			// Empty list of ghost drive data records
			let lists_ghostcar: wm.wm.protobuf.LoadGhostDriveDataResponse.GhostDriveData[] = [];

            // Check how many opponent ghost data available (including user data)
			for(let i=0; i<body.carTunings.length; i++)
			{ 
                // Check if opponent ghost have trail
				let ghost_trails = await prisma.ghostTrail.findFirst({ 
					where: {
						carId: body.carTunings[i].carId!,
						path: path,
					},
					orderBy: {
						playedAt: 'desc'
					}
				});
				
				// ---Get the user and opponent ghost trail data---
				let ghostType: number = wm.wm.protobuf.GhostType.GHOST_NORMAL;
				let lists_binarydriveData;
				if(ghost_trails?.driveData !== null && ghost_trails?.driveData !== undefined){
					lists_binarydriveData = wm.wm.protobuf.BinaryData.create({
						data: ghost_trails!.driveData!,
						mergeSerial: ghost_trails!.driveDMergeSerial!
					});
				}

				let lists_binaryByArea
				if(ghost_trails?.trendBinaryByArea !== null && ghost_trails?.trendBinaryByArea !== undefined){
					lists_binaryByArea = wm.wm.protobuf.BinaryData.create({
						data:  ghost_trails!.trendBinaryByArea!,
						mergeSerial: ghost_trails!.byAreaMergeSerial!
					});
				}

				let lists_binaryByCar
				if(ghost_trails?.trendBinaryByCar !== null && ghost_trails?.trendBinaryByCar !== undefined){
					lists_binaryByCar = wm.wm.protobuf.BinaryData.create({
						data: ghost_trails!.trendBinaryByCar!,
						mergeSerial: ghost_trails!.byCarMergeSerial!
					});
				}

				let lists_binaryByUser
				if(ghost_trails?.trendBinaryByUser !== null && ghost_trails?.trendBinaryByUser !== undefined){
					lists_binaryByUser = wm.wm.protobuf.BinaryData.create({
						data: ghost_trails!.trendBinaryByUser!,
						mergeSerial: ghost_trails!.byUserMergeSerial!
					});
				}
				// ------------------------------------------------


                // Push the data
				lists_ghostcar.push(wm.wm.protobuf.LoadGhostDriveDataResponse.GhostDriveData.create({ // Push the data
					carId: Number(body.carTunings[i].carId!),
					type: ghostType,
					driveData: lists_binarydriveData || null,
					trendBinaryByArea: lists_binaryByArea || null,
					trendBinaryByCar: lists_binaryByCar || null,
					trendBinaryByUser: lists_binaryByUser || null,
				}));
			}

            // Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
				data: lists_ghostcar
			};

            // Encode the response
			let message = wm.wm.protobuf.LoadGhostDriveDataResponse.encode(msg);
            
            // Send the response to the client
            common.sendResponse(message, res);
        })


        // Saving the ghost trail on mileage screen
		app.post('/method/register_ghost_trail', async (req, res) => {

            // Get the request body for the register ghost trail request
			let body = wm.wm.protobuf.RegisterGhostTrailRequest.decode(req.body);

            // Get the session id
			let actualSessionId: number = 0;

			// If the session are set, and are long data
            if(Long.isLong(body.ghostSessionId))
            {
                // Convert them to BigInt and add to the data
                actualSessionId = common.getBigIntFromLong(body.ghostSessionId);
            }

            // OCM game mode session id
			if(actualSessionId > 100 && actualSessionId < 201)
			{ 
				console.log('OCM Ghost Battle Game found');

				// User playing ocm battle game mode
				await ghost_save_trail.saveOCMGhostTrail(body);
			}
            // Ghost Battle or Crown Ghost Battle game Mode session id
			else if(actualSessionId > 0 && actualSessionId < 101)
			{
                // Check if it is crown ghost battle or not (crown ghost battle don't have time, driveData, trendBinaryByArea, trendBinaryByCar, trendBinaryByUser value from request body)
				if(!(body.trendBinaryByArea) && !(body.trendBinaryByCar) && !(body.trendBinaryByUser))
				{
					console.log('Crown Ghost Battle Game found');

					// User is playing crown ghost battle game mode
					await ghost_save_trail.saveCrownGhostTrail(body);
				}
				else
				{
					console.log('Normal Ghost Battle Game found');

					// User is playing normal ghost battle game mode
					await ghost_save_trail.saveNormalGhostTrail(body);

					// Saving Ghost Path and Tuning
					await ghost_save_trail.savePathAndTuning(body);
				}
			}
	
            // Response data
			let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS
			}
			
			// Encode the response
            let message = wm.wm.protobuf.RegisterGhostTrailResponse.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
		})


        // Load Crown Ghost Trail or Top 1 OCM Ghost Trail
		app.get('/resource/ghost_trail', async (req, res) => {	

            // Get url query parameter [For Crown Ghost Battle]
			let pCarId = Number(req.query.car_id);
			let pArea = Number(req.query.area); 

            // Get url query parameter [For OCM Ghost Battle]
			let pTrailId = Number(req.query.trail_id) || undefined;

			// Declare variable
			let rampVal: number = 0;
			let pathVal: number = 0;
			let playedAt: number = 0;
			let ghostTrail;

            // Query parameter from OCM Battle available
			if(pTrailId)
			{ 
                // Get the trail data
				let ghost_trails = await ghost_trail.getOCMGhostTrail(pCarId, pTrailId);

				pArea = ghost_trails.areaVal;
				rampVal = ghost_trails.rampVal;
				pathVal = ghost_trails.pathVal;
				playedAt = ghost_trails.playedAt;
				ghostTrail = ghost_trails.ghostTrail;
			}
            // Query parameter from Crown Ghost Battle available
			else
			{ 
				// Get the crown trail data
				let ghost_trails = await ghost_trail.getCrownGhostTrail(pCarId, pArea);

				rampVal = ghost_trails.rampVal;
				pathVal = ghost_trails.pathVal;
				playedAt = ghost_trails.playedAt;
				ghostTrail = ghost_trails.ghostTrail;
			}

            // Response data
			let msg = {
				carId: pCarId,
				area: pArea,
				ramp: rampVal,
				path: pathVal,
				playedAt: playedAt,
				trail: ghostTrail
			};
			
			// Encode the response
            let message = wm.wm.protobuf.GhostTrail.encode(msg);

            // Send the response to the client
            common.sendResponse(message, res);
		})


        // Load ghost path and tunings per area 
		app.post('/method/load_paths_and_tunings', async (req, res) => {

            // Get the request body for the load path and tunings request
			let body = wm.wm.protobuf.LoadPathsAndTuningsRequest.decode(req.body);

			// Empty list of car path and tuning records
			let carTbyP: wm.wm.protobuf.LoadPathsAndTuningsResponse.CarTuningsByPath[] = [];

            // Loop GID_RUNAREA_*
			for(let j=0; j<19; j++)
			{
                // 14 - 16 are dummy area, 17 is C1 Closed
				if(j >= 14){
					j = 18; // GID_RUNAREA_HIROSHIMA
				}
				let rampVal = 0;
				let pathVal = 0;

				// Get the ramp and path id
				let ghost_areas = await ghost_area.GhostArea(j);

				// Set the value
				rampVal = ghost_areas.rampVal;
				pathVal = ghost_areas.pathVal;

				// Empty list of car tuning records
				let carTuning: wm.wm.protobuf.CarTuning[] = [];
				let pathAndTuning: CarPathandTuning | null;

                // Loop to how many opponent ghost selected by user
				for(let i=0; i<body.selectedCars.length; i++)
				{ 
                    // Get path and tuning per area
					pathAndTuning = await prisma.carPathandTuning.findFirst({
						where: {
							carId: body.selectedCars[i],
							area: j
						},
						orderBy: {
							area: 'asc'
						}
					});

                    // Opponent ghost have path and tuning record for certain area
					if(pathAndTuning)
					{
                        // Push the data
						carTuning.push(wm.wm.protobuf.CarTuning.create({ 
							carId: body.selectedCars[i],
							tunePower: pathAndTuning!.tunePower,
							tuneHandling: pathAndTuning!.tuneHandling,
							lastPlayedAt: pathAndTuning!.lastPlayedAt,
						}));
					}
                    // Opponent ghost doesn't have path and tuning record for certain area
					else
					{ 
                        // Get user's car last used tunePower and tuneHandling
						let car = await prisma.car.findFirst({ 
							where: {
								carId: body.selectedCars[i]
							},
							select:{
								tunePower: true,
								tuneHandling: true
							}
						});	

                        // Push the data
						carTuning.push(wm.wm.protobuf.CarTuning.create({ 
							carId: body.selectedCars[i],

                            // Set the tunePower used when last played the game
							tunePower: car!.tunePower, 

                            // Set the tuneHandling used when last played the game
							tuneHandling: car!.tuneHandling 
						}));
					}
				}

                // Push the data
				carTbyP.push(wm.wm.protobuf.LoadPathsAndTuningsResponse.CarTuningsByPath.create({
					area: j,
					ramp: rampVal,
					path: pathVal,
					carTunings: carTuning,
					selectionMethod: wm.wm.protobuf.PathSelectionMethod.PATH_NORMAL // idk what this is
				}));
			}

            // Response data
            let msg = {
				error: wm.wm.protobuf.ErrorCode.ERR_SUCCESS,
				data: carTbyP
			};

            // Encode the response
			let message = wm.wm.protobuf.LoadPathsAndTuningsResponse.encode(msg);

			// Send the response to the client
            common.sendResponse(message, res);
		})


        // Lock Crown
        app.post('/method/lock_crown', (req, res) => {

			// Get the information from the request
			let body = wmsrv.wm.protobuf.LockCrownRequest.decode(req.body);

            // Response data
            let msg = {
				error: wmsrv.wm.protobuf.ErrorCode.ERR_SUCCESS,
			};

            // Encode the response
			let message = wmsrv.wm.protobuf.LockCrownResponse.encode(msg);

			// Send the response to the client
            common.sendResponse(message, res);
        })
    

		// Load Ghost Bingo
		app.post('/method/load_ghost_bingo_targets', async (req, res) => {

			// Get the information from the request 
			let body = wmsrv.wm.protobuf.LoadGhostBingoTargetsRequest.decode(req.body);

			// Randomize ramp and path?
			let rampVal = 0;
			let pathVal = 0;

			// Get the ramp and path id
			let ghost_areas = await ghost_area.GhostArea(body.area);

			// Get the area id and ramp id
            let lists_ghostcar: wm.wm.protobuf.GhostCar[] = [];
			let arr = [];
			let maxNumber = 0;

			// Get Ghost List
            let car = await prisma.car.findMany({
                where:{
                    
                },
                include:{
                    gtWing: true,
                    lastPlayedPlace: true
                }
            });

			// If all user car data available is more than 10 for certain level
			if(car.length > 10)
			{ 
				maxNumber = 10 // Limit to 10 (game default)
			}
            // If no more than 10
			else
			{
				maxNumber = car.length;
			}

            while(arr.length < maxNumber)
			{ 
                // Pick random car Id
				let randomNumber: number = Math.floor(Math.random() * car.length);

                if(arr.indexOf(randomNumber) === -1)
                {
                    // Push current number to array
					arr.push(randomNumber); 

                    // Check if ghost trail for certain car is available
						let ghost_trails = await prisma.ghostTrail.findFirst({
							where: {
								carId: car[randomNumber].carId,
								area: body.area,
								crownBattle: false
							},
							orderBy: {
								playedAt: 'desc'
							}
						});

						// If regionId is 0 or not set, game will crash after defeating the ghost
						if(car[randomNumber]!.regionId === 0)
						{ 
							let randomRegionId = Math.floor(Math.random() * 47) + 1;
							car[randomNumber].regionId = randomRegionId;
						}

						// Push user's car data without ghost trail
						if(!(ghost_trails))
						{ 
							lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
								car: car[randomNumber],
								area: body.area,
								ramp: rampVal,
								path: pathVal,
								nonhuman: true,
								type: wm.wm.protobuf.GhostType.GHOST_NORMAL,					
							}));
						}
						// Push user's car data with ghost trail
						else
						{
							// Set the tunePower used when playing certain area
							car[randomNumber].tunePower = ghost_trails!.tunePower;

							// Set the tuneHandling used when playing certain area
							car[randomNumber].tuneHandling = ghost_trails!.tuneHandling;

							// Push data to Ghost car proto
							lists_ghostcar.push(wm.wm.protobuf.GhostCar.create({
								car: car[randomNumber],
								area: body.area,
								ramp: rampVal,
								path: pathVal,
								nonhuman: false,
								type: wm.wm.protobuf.GhostType.GHOST_NORMAL,
								trailId: ghost_trails!.dbId!
							}));
						} 
                }
            }
			
			
			//Response Data
			let msg = {
				error: wmsrv.wm.protobuf.ErrorCode.ERR_SUCCESS,
				ghosts: lists_ghostcar,
				selectionMethod: wm.wm.protobuf.PathSelectionMethod.PATH_NORMAL
			};

			//Encode the response 
			let message = wmsrv.wm.protobuf.LoadGhostBingoTargetsResponse.encode(msg);

			//Send the responce to the client
			common.sendResponse(message, res)
		})
	}
}