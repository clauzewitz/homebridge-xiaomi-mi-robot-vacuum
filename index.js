const miio = require('miio');
const util = require('util');
let Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;

	homebridge.registerAccessory('homebridge-xiaomi-robot-vacuum', 'MiRobotVacuum', MiRobotVacuum);
}

function initCustomService() {
	const baseProp = {
		format: Characteristic.Formats.FLOAT,
		unit: '%',
		perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
	};

	let careSensorsUUID = UUIDGen.generate('Care Indicator sensors');
	Characteristic.CareSensors = function () {
		Characteristic.call(this, 'Care Indicator sensors', careSensorsUUID);
		
		this.setProp(baseProp);

		this.value = this.getDefaultValue();
	};
	util.inherits(Characteristic.CareSensors, Characteristic);
	Characteristic.CareSensors.UUID = careSensorsUUID;

	let careFilterUUID = UUIDGen.generate('Care Indicator filter');
	Characteristic.CareFilter = function () {
		Characteristic.call(this, 'Care Indicator filter', careFilterUUID);
		
		this.setProp(baseProp);

		this.value = this.getDefaultValue();
	};
	util.inherits(Characteristic.CareFilter, Characteristic);
	Characteristic.CareFilter.UUID = careFilterUUID;

	let careSideBrushUUID = UUIDGen.generate('Care Indicator side brush');
	Characteristic.CareSideBrush = function () {
		Characteristic.call(this, 'Care Indicator side brush', careSideBrushUUID);
		
		this.setProp(baseProp);

		this.value = this.getDefaultValue();
	};
	util.inherits(Characteristic.CareSideBrush, Characteristic);
	Characteristic.CareSideBrush.UUID = careSideBrushUUID;

	let careMainBrushUUID = UUIDGen.generate('Care Indicator main brush');
	Characteristic.CareMainBrush = function () {
		Characteristic.call(this, 'Care Indicator main brush', careMainBrushUUID);
		
		this.setProp(baseProp);

		this.value = this.getDefaultValue();
	};
	util.inherits(Characteristic.CareMainBrush, Characteristic);
	Characteristic.CareMainBrush.UUID = careMainBrushUUID;

	let careUUID = UUIDGen.generate('Care Service');
	Service.Care = function (displayName, subType) {
		Service.call(this, displayName, careUUID, subType);

		this.addCharacteristic(Characteristic.CareSensors);
		this.addCharacteristic(Characteristic.CareFilter);
		this.addCharacteristic(Characteristic.CareSideBrush);
		this.addCharacteristic(Characteristic.CareMainBrush);
	}
	util.inherits(Service.Care, Service);
	Service.Care.UUID = careUUID;
}

function MiRobotVacuum(log, config) {
	this.services = [];
	this.log = log;
	this.name = config.name || 'Vacuum Cleaner';
	this.ip = config.ip;
	this.token = config.token;
	this.model = config.model || 'roborock.vacuum.v1';
	this.pause = config.pause;
	this.dock = config.dock;
	this.care = config.care;
	this.device = null;
	this.cleaningState = null;
	this.fanSpeed = null;
	this.chargingState = null;
	this.batteryLevel = null;
	this.dockState = null;

	if (!this.ip) {
		throw new Error('Your must provide IP address of the robot vacuum.');
	}

	if (!this.token) {
		throw new Error('Your must provide token of the robot vacuum.');
	}

	this.speedGroup = {
		v1: [
			0,	// Idle
			38,	// Quiet
			60,	// Balanced
			77,	// Turbo
			90	// Max Speed
		],
		s5: [
			0,	// Idle
			15, // Mopping
			38,	// Quiet
			60,	// Balanced
			75,	// Turbo
			100	// Max Speed
		]
	};

	// Vacuum cleaner is not available in Homekit yet, register as Fan
	this.fanService = new Service.Fan(this.name);
	this.batteryService = new Service.BatteryService(this.name + ' Battery');

	this.serviceInfo = new Service.AccessoryInformation();

	this.serviceInfo
		.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
		.setCharacteristic(Characteristic.Model, 'Robot Vacuum Cleaner');

	this.services.push(this.serviceInfo);

	this.fanService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));

	this.fanService
		.getCharacteristic(Characteristic.RotationSpeed)
		.on('get', this.getRotationSpeed.bind(this))
		.on('set', this.setRotationSpeed.bind(this));

	this.services.push(this.fanService);

	this.batteryService
		.getCharacteristic(Characteristic.BatteryLevel)
		.on('get', this.getBatteryLevel.bind(this));

	this.batteryService
		.getCharacteristic(Characteristic.ChargingState)
		.on('get', this.getChargingState.bind(this));

	this.batteryService
		.getCharacteristic(Characteristic.StatusLowBattery)
		.on('get', this.getStatusLowBattery.bind(this));

	this.services.push(this.batteryService);

	if (this.pause) {
		this.pauseService = new Service.Switch(this.name + ' Pause');

		this.pauseService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getPauseState.bind(this))
			.on('set', this.setPauseState.bind(this));

		this.services.push(this.pauseService);
	}

	if (this.dock) {
		this.dockService = new Service.OccupancySensor(this.name + ' Dock');

		this.dockService
			.getCharacteristic(Characteristic.OccupancyDetected)
			.on('get', this.getDockState.bind(this));

		this.services.push(this.dockService);
	}

	if (this.care) {
		initCustomService();

		this.careService = new Service.Care(this.name + ' Care');

		this.careService
			.getCharacteristic(Characteristic.CareSensors)
			.on('get', this.getCareSensorsState.bind(this));
	
		this.careService
			.getCharacteristic(Characteristic.CareFilter)
			.on('get', this.getCareFilterState.bind(this));
	
		this.careService
			.getCharacteristic(Characteristic.CareSideBrush)
			.on('get', this.getCareSideBrushState.bind(this));
	
		this.careService
			.getCharacteristic(Characteristic.CareMainBrush)
			.on('get', this.getCareMainBrushState.bind(this));
	}

	this.discover();
}

MiRobotVacuum.prototype = {
	discover: function() {
		const that = this;
		let log = that.log;

		miio.device({
			address: that.ip,
			token: that.token,
			model: that.model
		})
		.then(device => {
			if (device.matches('type:vaccuum')) {
				that.device = device;

				log.debug('Discovered Mi Robot Vacuum at %s', that.ip);

				log.debug('Model         : ' + device.miioModel);
				log.debug('State         : ' + device.property('state'));
				log.debug('Fan Speed     : ' + device.property('fanSpeed'));
				log.debug('Battery Level : ' + device.property('batteryLevel'));

				device.state()
					.then(state => {
						state = JSON.parse(JSON.stringify(state));

						if (state.error !== undefined) {
							console.log(state.error);
							return;
						}

						// Initial states
						that.updateCleaningState(state.cleaning);
						that.updateChargingState(state.charging);
						that.updateFanSpeed(state.fanSpeed);
						that.updateBatteryLevel(state.batteryLevel);

						// State change events
						device.on('stateChanged', data => {
							state = JSON.parse(JSON.stringify(data));

							if (state['key'] == 'cleaning') {
								that.updateCleaningState(state['value']);
							}
							
							if (state['key'] == 'charging') {
								that.updateChargingState(state['value']);
							}

							if (state['key'] == 'fanSpeed') { 
								that.updateFanSpeed(state['value']);
							}

							if (state['key'] == 'batteryLevel') {
								that.updateBatteryLevel(state['value']);
							}
						});
					})
					.catch(err => console.log(err));
			} else {
				log.debug('Device discovered at %s is not Mi Robot Vacuum', this.ip);
			}
		})
		.catch(err => {
			log.debug('Failed to discover Mi Robot Vacuum at %s', this.ip);
			log.debug('Will retry after 30 seconds');
			setTimeout(function() {
				that.discover();
			}, 30000);
		});
	},

	updateCleaningState: function(state) {
		this.log.debug('Cleaning State -> %s', state);
		this.cleaningState = state;

		if (this.dock) {
			this.dockState = !state;
			this.dockService.getCharacteristic().updateValue(state);
		}
	},

	updateChargingState: function(state) {
		this.log.debug('Charging State -> %s', state);
		this.chargingState = state;
		
		if (this.dock) {
			this.dockState = state;
			this.dockService.getCharacteristic().updateValue(state);
		}

		this.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(state);
	},

	updateFanSpeed: function(speed) {
		this.log.debug('Fan Speed -> %s', speed);
		this.fanSpeed = speed;
		this.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed);
	},

	updateBatteryLevel: function(level) {
		this.log.debug('Battery Level -> %s', level);
		this.batteryLevel = level;
		this.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(level);
	},

	getPowerState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.cleaningState);
	},

	setPowerState: function(state, callback) {
		const that = this;

		if (!that.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		if (state) {
			that.device.activateCleaning();
		} else {
			that.device.call('app_stop', []);

			setTimeout(function() {
				that.device.call('app_charge', [], {
					refresh: [ 'state' ],
					refreshDelay: 1000
				});
			}, 2000);
		}

		callback();
	},

	getPauseState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.device.property('state') == 'paused'));
	},

	setPauseState: function(state, callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		if (state && this.device.property('state') == 'cleaning') {
			this.device.pause()
				.catch(err => console.log(err));
			
			callback(null, true);
			return;
		}
		
		if (!state && this.device.property('state') == 'paused') {
			this.device.activateCleaning()
				.catch(err => console.log(err));
			
			callback(null, false);
			return;
		}

		callback();
	},
	
	getDockState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
		}

		callback(null, this.dockState);
	},

	getRotationSpeed: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.fanSpeed);
	},

	setRotationSpeed: function(speed, callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		let speeds = this.speedGroup['v1'];

		if (this.model == 'roborock.vacuum.s5') {
			speeds = this.speedGroup['s5'];
		}

		for (var item in speeds) {
			if (speed <= item) {
				speed = item;
				break;
			}
		}

		this.device.changeFanSpeed(parseInt(speed));
		callback(null, speed);
	},

	getBatteryLevel: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.batteryLevel);
	},

	getStatusLowBattery: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.batteryLevel < 30) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
	},

	getChargingState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.chargingState) ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGEABLE);
	},

	getCareSensorsState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		var lifetimepercent = that.device.property("sensorDirtyTime") / 108000 * 100;

		callback(null, lifetimepercent);
	},

	getCareFilterState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		var lifetimepercent = that.device.property("filterWorkTime") / 540000 * 100;

		callback(null, lifetimepercent);
	},

	getCareSideBrushState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		var lifetimepercent = that.device.property("sideBrushWorkTime") / 720000 * 100;

		callback(null, lifetimepercent);
	},

	getCareMainBrushState: function(callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		var lifetimepercent = that.device.property("mainBrushWorkTime") / 1080000 * 100;

		callback(null, lifetimepercent);
	},

	identify: function(callback) {
		callback();
	},

	getServices: function() {
		return this.services;
	}
};
