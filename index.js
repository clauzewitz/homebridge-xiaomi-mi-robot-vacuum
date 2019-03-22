'use strict';

const miio = require('miio');
const inherits = require('util').inherits;
const version = require('./package.json').version;
let Service;
let Characteristic;
let logger;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory('homebridge-xiaomi-robot-vacuum', 'MiRobotVacuum', MiRobotVacuum);
}

function initCustomService() {
	/**
	 * Service "Vacuum"
	 */
	let vacuumUUID = '00000040-0000-1000-8000-0026BB765291';
	Service.Vacuum = function (displayName, subType) {
		Service.call(this, displayName, vacuumUUID, subType);

		// Required Characteristics
		this.addCharacteristic(Characteristic.On);
		this.addCharacteristic(Characteristic.BatteryLevel);
		this.addCharacteristic(Characteristic.ChargingState);
		this.addCharacteristic(Characteristic.StatusLowBattery);

		// Optional Characteristics
		this.addOptionalCharacteristic(Characteristic.RotationDirection);
		this.addOptionalCharacteristic(Characteristic.RotationSpeed);
		this.addOptionalCharacteristic(Characteristic.FilterLifeLevel);
		this.addOptionalCharacteristic(Characteristic.SideBrushLifeLevel);
		this.addOptionalCharacteristic(Characteristic.MainBrushLifeLevel);
		this.addOptionalCharacteristic(Characteristic.Name);
	}

	inherits(Service.Vacuum, Service);
	Service.Vacuum.UUID = vacuumUUID;
}

function MiRobotVacuum(log, config) {
	logger = log;

	this.services = [];
	this.name = config.name || 'Vacuum Cleaner';
	this.ip = config.ip;
	this.token = config.token;
	this.model = config.model || 'roborock.vacuum.v1';
	this.showDock = config.showDock || false;
	this.enablePause = config.enablePause || false;
	this.device = undefined;
	this.cleaningState = undefined;
	this.fanSpeed = undefined;
	this.chargingState = undefined;
	this.batteryLevel = undefined;
	this.dockState = undefined;

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

	initCustomService();

	// Vacuum cleaner is not available in Homekit yet, register as Fan
	this.service = new Service.Vacuum(this.name);
	this.serviceInfo = new Service.AccessoryInformation();

	this.serviceInfo
		.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
		.setCharacteristic(Characteristic.Model, 'Robot Vacuum Cleaner')
		.setCharacteristic(Characteristic.SerialNumber, this.token.toUpperCase())
		.setCharacteristic(Characteristic.FirmwareRevision, version);

	this.service
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));

	this.service
		.getCharacteristic(Characteristic.RotationSpeed)
		.on('get', this.getRotationSpeed.bind(this))
		.on('set', this.setRotationSpeed.bind(this));

	this.service
		.getCharacteristic(Characteristic.BatteryLevel)
		.on('get', this.getBatteryLevel.bind(this));

	this.service
		.getCharacteristic(Characteristic.ChargingState)
		.on('get', this.getChargingState.bind(this));

	this.service
		.getCharacteristic(Characteristic.StatusLowBattery)
		.on('get', this.getStatusLowBattery.bind(this));

	this.service
		.getCharacteristic(Characteristic.FilterLifeLevel)
		.on('get', this.getFilterState.bind(this));

	this.services.push(this.service);
	this.services.push(this.serviceInfo);

	if (this.enablePause) {
		this.pauseService = new Service.Switch(this.name + ' Pause');

		this.pauseService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getPauseState.bind(this))
			.on('set', this.setPauseState.bind(this));

		this.services.push(this.pauseService);
	}

	if (this.showDock) {
		this.dockService = new Service.MotionSensor(this.name + ' Dock');

		this.dockService
			.getCharacteristic(Characteristic.MotionDetected)
			.on('get', this.getDockState.bind(this));

		this.services.push(this.dockService);
	}

	this.discover();
}

MiRobotVacuum.prototype = {
	discover: function () {
		const that = this;

		miio.device({
			address: that.ip,
			token: that.token,
			model: that.model
		})
		.then(device => {
			if (device.matches('type:vacuum')) {
				that.device = device;

				logger.debug('Discovered Mi Robot Vacuum at %s', that.ip);
				logger.debug('Model         : ' + device.miioModel);
				logger.debug('State         : ' + device.property('state'));
				logger.debug('Fan Speed     : ' + device.property('fanSpeed'));
				logger.debug('Battery Level : ' + device.property('batteryLevel'));

				device.state()
					.then(state => {
						state = JSON.parse(JSON.stringify(state));

						if (state.error !== undefined) {
							logger.debug(state.error);
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
					.catch(error => {
						logger.debug(error);
					});
			} else {
				logger.debug('Device discovered at %s is not Mi Robot Vacuum', that.ip);
			}
		})
		.catch(err => {
			logger.debug('Failed to discover Mi Robot Vacuum at %s', that.ip);
			logger.debug('Will retry after 30 seconds');

			setTimeout(function () {
				that.discover();
			}, 30000);
		});
	},

	updateCleaningState: function (state) {
		logger.debug('Cleaning State -> %s', state);
		this.cleaningState = state;

		if (this.showDock) {
			this.dockState = !state;
			this.dockService.getCharacteristic(Characteristic.MotionDetected).updateValue(state);
		}
	},

	updateChargingState: function (state) {
		logger.debug('Charging State -> %s', state);
		this.chargingState = state;
		
		if (this.showDock) {
			this.dockState = state;
			this.dockService.getCharacteristic(Characteristic.MotionDetected).updateValue(state);
		}

		this.service.getCharacteristic(Characteristic.ChargingState).updateValue(state);
	},

	updateFanSpeed: function (speed) {
		logger.debug('Fan Speed -> %s', speed);
		this.fanSpeed = speed;
		this.service.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed);
	},

	updateBatteryLevel: function (level) {
		logger.debug('Battery Level -> %s', level);
		this.batteryLevel = level;
		this.service.getCharacteristic(Characteristic.BatteryLevel).updateValue(level);
	},

	getPowerState: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.cleaningState);
	},

	setPowerState: function (state, callback) {
		const that = this;

		if (!that.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		if (state) {
			that.device.activateCleaning();
		} else {
			that.device.call('app_stop', []);

			setTimeout(function () {
				that.device.call('app_charge', [], {
					refresh: [ 'state' ],
					refreshDelay: 1000
				});
			}, 2000);
		}

		callback();
	},

	getPauseState: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.device.property('state') == 'paused'));
	},

	setPauseState: function (state, callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		if (state && this.device.property('state') == 'cleaning') {
			this.device.pause()
				.catch(error => {
					logger.debug(error);
				});
			
			callback(null, true);
			return;
		}
		
		if (!state && this.device.property('state') == 'paused') {
			this.device.activateCleaning()
				.catch(error => {
					logger.debug(error);
				});
			
			callback(null, false);
			return;
		}

		callback();
	},
	
	getDockState: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.dockState);
	},

	getRotationSpeed: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.fanSpeed);
	},

	setRotationSpeed: function (speed, callback) {
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

		this.device.changeFanSpeed(Number(speed));
		callback(null, speed);
	},

	getBatteryLevel: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, this.batteryLevel);
	},

	getStatusLowBattery: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.batteryLevel < 30) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
	},

	getChargingState: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.chargingState) ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGEABLE);
	},

	getFilterState: function (callback) {
		if (!this.device) {
			callback(new Error('No robot is discovered.'));
			return;
		}

		callback(null, (this.device.property("filterWorkTime") / 540000 * 100));
	},

	identify: function (callback) {
		callback();
	},

	getServices: function () {
		return this.services;
	}
};
