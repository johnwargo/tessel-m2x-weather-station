/* jshint browser: false */
/* jshint undef: true, unused: true */
/* global console*/
"use strict";

/**********************************************************
 * Tessel Weather Station
 *
 * by John M. Wargo
 * www.johnwargo.com
 *
 **********************************************************/
// use the blue LED when showing activity, change to 2 for green LED
const ACTIVITY_LED = 3;
//Change MODULE_PORT to B id your temperature module is plugged into the Tessel's port B
const MODULE_PORT = 'A';
// how frequently data is uploaded to M2X
const UPLOAD_INTERVAL = 1; //minute(s)

//===============================================
// Project-specific requires
//===============================================
//Load the server's external configuration file
const Config = require('./config.js');
// Import the Tessel hardware library
const tessel = require('tessel');
//load the Tessel climate module library
const climatelib = require('climate-si7020');
const climate = climatelib.use(tessel.port[MODULE_PORT]);

const M2X = require("m2x-tessel");
const m2x = new M2X(Config.M2X_API_KEY);

//Turn off the Activity LED, just in case it's already on for some reason
tessel.led[ACTIVITY_LED].off();

//Do we have the M2X configuration values we need?
console.log("Validating application configuration");
if (Config.M2X_DEVICE_ID === '' || Config.M2X_API_KEY === '') {
  //Tell the user
  console.error('\nSTOP: Missing M2X configuration values\n');
  //get out of here
  process.exit(1);
}

console.log("Checking M2X status");
m2x.status(function (status) {
  console.log("\nReceived M2X status");
  console.dir(status);
});

//=========================================================
//Now start working on climate data collection and upload
//=========================================================
climate.on('ready', function () {
  console.log('\nConnected to climate module');

  //Get the current timestamp
  var timestamp = new Date();
  //Now, get the current minute minus 1
  var lastMin = timestamp.getMinutes() - 1;
  // if less than 0, set to 59. This forces a measurement to be taken at the start every time
  lastMin = (lastMin < 0) ? 59 : lastMin;
  console.log('Last minute: %s\n', lastMin);

  // Loop forever
  setImmediate(function loop() {
    var currentMin = new Date().getMinutes();
    //has the minute changed? We'll take a measurement every minute
    if (currentMin != lastMin) {
      //Reset our lastMin variable
      lastMin = currentMin;
      //Turn on the activity LED
      tessel.led[ACTIVITY_LED].on();
      //Read the temperature from the climate module
      climate.readTemperature('f', function (err, temp) {
        //Turn off the activity LED
        tessel.led[ACTIVITY_LED].off();
        //Write the results to the console
        console.log('\nDegrees: %s F', temp.toFixed(1));
        //Is it time to upload?
        if (currentMin < 1 || currentMin % UPLOAD_INTERVAL == 0) {
          //upload the data to M2X
          console.log('Sending data to M2X');
          m2x.devices.setStreamValue(Config.M2X_DEVICE_ID, Config.M2X_STREAM, {"value": temp}, function (result) {
            console.dir(result);
            if (result.isError()) {
              console.error(result.error());
            }
          });
        }
      });
    }
    // do it again in 1 second
    setTimeout(loop, 1000);
  });
});