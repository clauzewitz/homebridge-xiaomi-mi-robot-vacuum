[![npm version](https://badge.fury.io/js/homebridge-xiaomi-robot-vacuum.svg)](https://badge.fury.io/js/homebridge-xiaomi-robot-vacuum)

# homebridge-xiaomi-robot-vacuum
This project is forked from [homebridge-xiaomi-mi-robot-vacuum](https://github.com/seikan/homebridge-xiaomi-mi-robot-vacuum).

This is Xiaomi Mi Robot Vacuum plugin for [Homebridge](https://github.com/nfarina/homebridge). Since Apple Homekit is not supporting vacuum cleaner device yet, this plugin will add the robot as **Fan** to your Home app.

![roborock-vacuum-v1](https://user-images.githubusercontent.com/12408302/54580338-02b61200-4a4b-11e9-9f02-f03827dd5918.jpg)
![roborock-vacuum-s5](https://user-images.githubusercontent.com/12408302/54580352-106b9780-4a4b-11e9-98a4-92026f8712c4.jpg)



### Features
* Switch on / off. When off, it will returning to charging dock automatically.

* Control suction power by adjust the fan speed.
	+ Xiaomi Mi Robot 1st Generation (Roborock Vacuum V1)
		- Quiet (1 -38%)
		- Balance (39 - 60%)
		- Turbo (61 - 77%)
		- Max Speed (> 77%)

	+ Xiaomi Roborock S50 2nd Generation (Roborock Vacuum S5)
		- Mopping (1 -15%)
		- Quiet (16 -38%)
		- Balance (39 - 60%)
		- Turbo (61 - 75%)
		- Max Speed (> 76%)

* Display battery level, and notify on low battery.

* Display battery charging state.

* Display filter state.



### Installation
1. Install required packages.

	```
	npm install -g homebridge-xiaomi-robot-vacuum miio
	```

2. Remove Mi Robot Vaccum from your Mi Home app.

3. Press "Power" and "Home" button simultaneously and hold for 3 seconds on your Mi Robot Vacuum to reset the Wi-Fi.

	![mi-robot-reset-wifi](https://cloud.githubusercontent.com/assets/73107/26273343/278c36a2-3d61-11e7-8e08-b5bc25cc407f.png)

4. It will advertised a new Wi-Fi spot similar to`rockrobo-vacuum-v1_xxxx` or `roborock-vacuum-s5_xxxx`.

5. Connect your PC to that Wi-Fi network.

6. Open command prompt or terminal. Run following command to discover the device:

	```
	miio discover --sync
	```

	**Notes:** This will take about a minute or two.

7. Wait until you get output similar to this:

	```
	Device ID: 49466045
	Model info: Unknown
	Address: 192.168.8.1
	Token: 6f7a65786550386b755a6b526666744d via auto-token
	Support: Unknown
	```

8. Record down the value value for `Token` as we need it later.

9. Disconnect from robot Wi-Fi network.

10. Open Mi Home app and add the device as usual.

11. In Mi Home app, get the Robot Vacuum IP address from General Settings > Network Info.

12. Check the model name of the vacuum cleaner.\
	If it is a 1st Generation, write `rockrobo.vacuum.v1`.\
	If it's a 2nd Generation product, write `roborock.vacuum.s5`.

12. Add these values to `config.json`.

	```
		"accessories": [
			{
				"accessory": "MiRobotVacuum",
				"name": "Vacuum Cleaner",
				"model": "MODEL_DISCOVERED_FROM_STEP_12",
				"ip": "IP_ADDRESS_OF_THE_ROBOT",
				"token": "TOKEN_DISCOVERED_FROM_STEP_7",
				"showDock": false,
				"enablePause": false
			}
		]
	```

	​Set "showDock" to `true` or `false`  to display or hide docked state for the vacuum.\
	​Set "enablePause" to `true` or `false`  to display or hide pause button for the vacuum.

13. Restart Homebridge, and your Mi Robot Vacuum will be added to Home app.



# License
MIT License
