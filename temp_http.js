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

//Change MODULE_PORT to B id your temperature module is plugged into the Tessel's port B
const MODULE_PORT = 'A';

//===============================================
// Project-specific requires
//===============================================
//Load the server's external configuration file
const Config = require('./config.js');
// Import the Tessel hardware library
const tessel = require('tessel');
//load the Tessel climate module library
const climatelib = require('climate-si7020');
//connect the climate object to Tessel port MODULE_PORT
const climate = climatelib.use(tessel.port[MODULE_PORT]);

//Other node modules used by this app
const http = require('http');

//Do we have the M2X configuration values we need?
console.log("\nValidating configuration");
if (Config.M2X_HOST === '' || Config.M2X_PATH === '' || Config.M2X_STREAM === '' || Config.M2X_API_KEY === '') {
  //Tell the user
  console.error('\nSTOP: Missing M2X configuration values\n');
  //get out of here
  process.exit(1);
}

//=========================================================
//Now start working on climate data collection and upload
//=========================================================
climate.on('ready', function () {
  console.log('Connected to the climate module');

  //Get the current timestamp
  var timestamp = new Date();
  //Now, get the current minute minus 1
  var lastMin = timestamp.getMinutes() - 1;
  // if less than 0, set to 59. This forces a measurement to be taken at the start every time
  lastMin = (lastMin < 0) ? 59 : lastMin;

  // Loop forever
  setImmediate(function loop() {
    var currentMin = new Date().getMinutes();
    //has the minute changed? We'll take a measurement every minute
    if (currentMin != lastMin) {
      //Reset our lastMin variable
      lastMin = currentMin;
      //Read the temperature from the climate module
      climate.readTemperature('f', function (err, temp) {
        // log the current temperature value
        console.log('\nTemperature: %s F', temp.toFixed(2));
        // console.log('Sending data to M2X');
        //Send the data to M2X, using this article as a reference:
        //http://www.multitech.net/developer/software/mlinux/mlinux-software-development/node-js-examples/
        //Build the request body
        var data = JSON.stringify({'value': parseFloat(temp.toFixed(2))});
        // console.log("data:", data)
        //setup HTTP options
        var options = {
          method: 'PUT',
          host: Config.M2X_HOST,
          path: Config.M2X_PATH + '/streams/' + Config.M2X_STREAM + '/value',
          headers: {
            'X-M2X-KEY': Config.M2X_API_KEY,
            "Content-Type": "application/json",
            "Content-Length": data.length
          }
        };
        // console.dir(options);
        //Make the request
        var req = http.request(options, function (res) {
          console.log('\nM2X RESPONSE');
          console.log('STATUS: ' + res.statusCode);
          console.log('HEADERS: ' + JSON.stringify(res.headers));
          var body = '';
          res.on('data', function (data) {
            body += data;
          });
          res.on('end', function () {
            console.log(body);
          });
        });
        req.on('error', function (e) {
          console.dir(e);
        });
        // req.write(data);
        req.end(data);
      });
    }
    // do it again in 1 second
    setTimeout(loop, 1000);
  });
});