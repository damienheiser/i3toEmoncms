var cheerio = require('cheerio')
var request = require('request')
request = request.defaults ({jar: true})
var util = require('util')
var levelup = require('levelup')
var leveldown = require('leveldown')
var db = levelup(leveldown('./i3ConnectedDriveEmonCMSDB'))

// run from the command line 'node i3toEmoncms.js'
/// EDIT THINGS BELOW THIS!!!

// Set both of these to true to run this script and always put the data into emoncms
// Set both of these to false to run this script and only place new events into emoncms
var updateEmonCmsNoChange = false // true will always update EmonCMS, even if no data changes.
var updateEmonCmsIfDriving = false // true will update EmonCMS when driving, corrects for undefined and zero values

var loginObject = {
	username: 'user%40domain.com', //Replace @ with %40 (ie. user%40domain.com)
	password: 'YOURPASSWORD', // your password
	emonCmsURL: 'https://www.emoncms.org/', //emoncms post url
	emonCmsAPIKey : '' // your emoncms.org write key
}

/// DON'T EDIT ANYTHING ELSE

var output = {
	lastTrip: 0, 
	lastTripEfficiency: 0,
	electricMileage: 0,
	electricMileageCommunityMax: 0,
	electricMileageCommunityAverage: 0,
	electricDistanceDrivenSinceLastCharged: 0,
	electricDistanceDrivenSinceLastChargedMax: 0,
	electricDistanceDrivenSinceLastChargedCommunityMax: 0,
	electricDistanceDrivenSinceLastChargedCommunityAverage: 0,
	consumptionmikWhTrip: 0,
	consumptionmikWhTotalAverage: 0,
	consumptionmikWhCommunityAverage: 0,
	recuperationmikWhTrip: 0,
	recuperationmikwhTotalAverage: 0,
	batteryChargeStatusPercentage: 0,
	batteryChargeStatusMilesRemain: 0,
	rexStatusPercentage: 0,
	rexStatusMilesRemain: 0
}


function getCookieString (callback) {
	console.log ('getting some delicious cookies...')
	var url = 'https://connecteddrive.bmwusa.com/cdp/release/internet/servlet/login?locale=en-us'
	var method = 'GET'
	var headers = {
		Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		'Accept-Language':'en-us',
	    'Accept-Encoding':'gzip, deflate',
		Origin:'https://connecteddrive.bmwusa.com',
		'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.3.5 (KHTML, like Gecko) Version/11.0.1 Safari/604.3.5',
		Connection:'keep-alive',
		DNT:1
	}

	request.get ({uri: url, headers:headers}, function (err, httpResponse, body) {
		cookieString = httpResponse.headers['set-cookie']
		callback (null, cookieString)
	})
}

function doLogin (callback) {
	getCookieString (function (error, cookieString) { 
		console.log ('attempting to login...')
		var url = 'https://connecteddrive.bmwusa.com/cdp/release/internet/servlet/login'
		var method = 'POST'

		var headers = {
			Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language':'en-us',
			'Accept-Encoding':'gzip, deflate',
			Origin:'https://connecteddrive.bmwusa.com',
			'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.3.5 (KHTML, like Gecko) Version/11.0.1 Safari/604.3.5',
			Connection:'keep-alive',
			DNT:1,
			'Content-Type': 'application/x-www-form-urlencoded',
			Referer: 'https://connecteddrive.bmwusa.com/cdp/release/internet/servlet/login?locale=en_US',
			Cookie: cookieString
		}

		var loginBody = 'timezoneOffset=480&actiontype=login&username='+loginObject.username+'&password=' + loginObject.password

		request.post ({uri: url, headers: headers, body:loginBody}, function (err, httpResponse, body) {
			if (httpResponse.statusCode == 302 || httpResponse.statusCode == 200) {
				console.log ('successful login!')
				//console.log (body)
				callback (null, {status: httpResponse.statusCode, headers: headers})
			} else {
				console.log ('boo!')
				callback (new Error('Error: response status code ' + httpResponse.StatusCode), null)
			}
		})
	})
}


function getStatistics (callback) {
	doLogin (function (error, status) {
		console.log ('retrieving statistics')

		url = 'https://connecteddrive.bmwusa.com/cdp/release/internet/servlet/statistics'

		headers = status.headers

		request.get ({uri: url, headers:headers}, function (err, httpResponse, body) {
			if (err) {callback (err, null)}
			console.log ('got em...')
			var $ = cheerio.load(body);	
			callback (null, $)
		})
	})
}

function postToEmonCMS (passValues, callback) {
	console.log ('posting to emoncms!')
	var stringValues = JSON.stringify (passValues)
	console.log (util.inspect(passValues))

	var postemoncms = {
		method: 'POST',
		uri: loginObject.emonCmsURL + '/input/post?node=BMWi3REx&data='+stringValues+'&apikey='+loginObject.emonCmsAPIKey
	}
	request (postemoncms, function (error, response, body) {
		if (error) {console.log ('Error' + error); self.close(process.exit (-1))}
		
		console.log (util.inspect(body))
		callback (null, body)
	})
}




function processStatistics (callback) {
	var lastMileage
	var lastTrip
	db.get ('lastMileage', function (error, value) {if (error) {callback(error,null)} else {lastMileage = value}})
	db.get ('lastTrip', function (error, value) {if (error) {callback(error,null)} else {lastTrip = value}})
	getStatistics (function (error, $) {
		if (error) {console.log (error); process.exit(-1)}
		console.log ('parsing data from nasty ass html...')
		if (performUpdate ($) == true || updateEmonCmsNoChange == true) {

			// If the battery charger status percentage is not being rendered, the car is driving, no data is being updated, so don't send an update
			output.batteryChargeStatusPercentage = batteryChargeStatusPercentage ($)
			if (output.batteryChargeStatusPercentage == '' && updateEmonCmsIfDriving == false) {
				console.log ('batteryChargeStatusPercentage ' + output.batteryChargeStatusPercentage)
				console.log ('Driving... not updating...')
				process.exit(0)
			} else if (output.batteryChargeStatusPercentage == '' && updateEmonCmsDriving == true) {
				delete output.batteryChargeStatusPercentage
				delete output.batteryChargeStatusMilesRemain
			
				delete output.rexStatusPercentage
				delete output.rexStatusMilesRemain
			} else {
				output.batteryChargeStatusMilesRemain = batteryChargeStatusMilesRemain ($)
			
				output.rexStatusPercentage = rexStatusPercentage ($)
				output.rexStatusMilesRemain = rexStatusMilesRemain ($)
			}
			
			// If there hasn't been any driving since the last update (i.e. battery is charging), don't update the trip based mileage information
			// Also accounts for no additional electric mileage, but gasoline mileage through Last Trip increasing.
			if ((electricMileage ($) == lastMileage && lastTripMileage($) == lastTrip) && updateEmonCmsNoChange == false ) 
			{
				delete output.lastTrip
				delete output.lastTripEfficiency
				delete output.electricDistanceDrivenSinceLastCharged
				delete output.consumptionmikWhTrip
				delete output.recuperationmikWhTrip
			} else {
				output.lastTrip = lastTripMileage ($)
				output.lastTripEfficiency = lastTripEfficiency ($)
				output.electricDistanceDrivenSinceLastCharged = electricDistanceDrivenSinceLastCharged ($)
				output.consumptionmikWhTrip = consumptionmikWhTrip ($)
				output.recuperationmikWhTrip = recuperationmikWhTrip ($)
			}

			//Always output the mileage if there's been an update.
			output.electricMileage = electricMileage ($)
			
			output.electricMileageCommunityMax = electricMileageCommunityMax ($)
			output.electricMileageCommunityAverage = electricMileageCommunityAverage ($)
			
			output.electricDistanceDrivenSinceLastChargedMax = electricDistanceDrivenSinceLastChargedMax ($)
			output.electricDistanceDrivenSinceLastChargedCommunityMax = electricDistanceDrivenSinceLastChargedCommunityMax ($)
			output.electricDistanceDrivenSinceLastChargedCommunityAverage = electricDistanceDrivenSinceLastChargedCommunityAverage ($)
			
			output.consumptionmikWhTotalAverage = consumptionmikWhTotalAverage ($)
			output.consumptionmikWhCommunityAverage = consumptionmikWhCommunityAverage ($)
			
			output.recuperationmikwhTotalAverage = recuperationmikwhTotalAverage ($)
			output.recuperationmikwhCommunityAverage = recuperationmikwhCommunityAverage ($)
			
			
			postToEmonCMS (output, function (error, body) {
				if (error) {console.log (error); process.exit(-1)}
				db.put ('lastUpdated', getCurrentLastUpdated($))
				db.put ('lastOutput', JSON.stringify(output))
				if (lastTripMileage($) != lastTrip) {
					db.put ('lastTrip', output.lastTrip)
				} 
				if (electricMileage($) != lastMileage)  {
					db.put ('lastMileage', output.electricMileage)
				}
				
				db.put ('lastMileage', output.electricMileage)
				console.log ('Writing to db... waiting for promises to be returned.')
				setTimeout (callback (null, body), 5000)
			})
		} else {
			console.log ('Current Update and Last Update match... not updating')
			process.exit(0)
		}
	})
}

// Process statistics (run program)
processStatistics (function (error, body) {
	if (error) {console.log (error); process.exit(-1)}
	else {console.log (body), process.exit()}
})

// Get the last time the page was updated
function getCurrentLastUpdated ($) {
	return $('div #teaserVehicleStatus p:nth-child(2)').text().substring(0, $('div #teaserVehicleStatus p:nth-child(2)').text().indexOf('\n'))
}

// Should an update be performed based on the the last updated date and the current updated date
function performUpdate ($) {
	var currentLastUpdated = getCurrentLastUpdated($)
	db.get ('lastUpdated', function (error, lastUpdated) {
		console.log ('last: ' + lastUpdated + ' | now: ' + currentLastUpdated)
		if (lastUpdated == currentLastUpdated) {
			return false
		} else {
			return true
		}
	})
}

// Get last trip mileage
function lastTripMileage ($) {
	//"Last trip 2.5 mlsAll trips"
	var i3LastTrip = $('div .statprofile h3').text()
	var i3LastTripLength = i3LastTrip.length
	var i3LastTripPlocation = i3LastTrip.indexOf('p')
	var i3LastTripmlsLocation = i3LastTrip.indexOf(' mls')
	return i3LastTrip.substring (i3LastTripPlocation+2, i3LastTripmlsLocation)
}

// Get last trip efficiency rating
function lastTripEfficiency ($, callback) {
	return  $('div #heros span').text().substring(0,2)
}

// My i3 electric only mileage
function electricMileage ($) {
	//"Electric distance driven:29076.9 mls"
	var i3Distance = $('div .statprofile div:nth-child(4) .heroLabel').text()
	var i3DistanceLength = i3Distance.length
	var i3ColonLocation = i3Distance.indexOf(':')
	var i3mlsLocation = i3Distance.indexOf(' mls')
	return i3Distance.substring(i3ColonLocation+1, i3mlsLocation)
}

// Maximum electric milage of the i3 community
function electricMileageCommunityMax ($) {
	//"82119.6"
	return $('div .score-glass-holder').next().next().attr('data-max')

}

// Averave electric mileage of the community
function electricMileageCommunityAverage ($) {
	//"Ø 18630.6"
	var i3 = $('div .statprofile div:nth-child(4) .community').text()
	var i3AvgLocation = i3.indexOf('Ø')
	var i3Length = i3.length
	return i3.substring(i3AvgLocation+2, i3Length)
}

// Electric distance driven since my i3 was last charged
function electricDistanceDrivenSinceLastCharged ($) {
	//"Electric distance driven (since last charged):41.0 mls"
	var i3Distance = $('div .statprofile div:nth-child(7) .heroLabel').text()
	var i3DistanceLength = i3Distance.length
	var i3ColonLocation = i3Distance.indexOf(':')
	var i3mlsLocation = i3Distance.indexOf(' mls')
	var i3Driven = i3Distance.substring(i3ColonLocation+1, i3mlsLocation)
	if (i3Driven == '--') {
		return 0
	} else {
		return i3Driven
	}
}

// Maximum distance my I3 has ever driven on one charge
function electricDistanceDrivenSinceLastChargedMax ($) {
	// "max. 70.8"
	var i3 = $('div .statprofile div:nth-child(5) .user').text()
	var i3MaxLocation = i3.indexOf('.')
	var i3Length = i3.length
	return i3.substring(i3MaxLocation+2, i3Length)
}

// BMW i3 Community maximum electric miles traveled
function electricDistanceDrivenSinceLastChargedCommunityMax ($) {
	// "122.0"
	return $('div .score-glass-holder').next().next().next().attr('data-max')
}

// BMW i3 Community Average MAXIMUM Electric Miles Traveled Before Charging
function electricDistanceDrivenSinceLastChargedCommunityAverage ($) {
	//"Ø 75.0"
	var i3 = $('div .statprofile div:nth-child(5) .community').text()
	var i3AvgLocation = i3.indexOf('Ø')
	var i3Length = i3.length
	return i3.substring(i3AvgLocation+2, i3Length)
}

// User This Trip
function consumptionmikWhTrip ($) {
	//"Consumption:2.1 mls/kWhElectric distance driven:29076.9 mlsRecuperation:6.9 mls/kWhElectric distance driven (since last charged):41.0 mls"
	var i3Consumption = $('div .statprofile div .heroLabel').text()
	var i3ConsumptionLength = i3Consumption.length
	var i3ColonLocation = i3Consumption.indexOf(':')
	var i3mlskwhLocation = i3Consumption.indexOf(' mls/kWh')
	return i3Consumption.substring(i3ColonLocation+1, i3mlskwhLocation)
}

// User all time average consumption
function consumptionmikWhTotalAverage ($) {
	//"Ø 3.5"
	var i3 = $('div .statprofile div:nth-child(2) .user').text()
	var i3AvgLocation = i3.indexOf('Ø')
	var i3Length = i3.length
	return i3.substring(i3AvgLocation+2, i3Length)

}

// BMW i3 Community Average Consumption
function consumptionmikWhCommunityAverage ($) {
	//"Ø 3.9"
	var i3 = $('div .statprofile div:nth-child(2) .community').text()
	var i3AvgLocation = i3.indexOf('Ø')
	var i3Length = i3.length
	return i3.substring(i3AvgLocation+2, i3Length)
}

// This trip recuperation
function recuperationmikWhTrip ($) {
	//"Recuperation:6.9 mls/kWh"
	var i3Recuperation = $('div .statprofile div:nth-child(5) .heroLabel').text()
	var i3ColonLocation = i3Recuperation.indexOf(':')
	var i3mlsLocation = i3Recuperation.indexOf(' mls')
	return i3Recuperation.substring(i3ColonLocation+1, i3mlsLocation)

}

// My total average of recuperation
function recuperationmikwhTotalAverage ($) {
	//"Ø 19.1"
	var i3 = $('div .statprofile div:nth-child(3) .user').text()
	var i3AvgLocation = i3.indexOf('Ø')
	var i3Length = i3.length
	return i3.substring(i3AvgLocation+2, i3Length)
}

// recuperation community average
function recuperationmikwhCommunityAverage ($) {
	//"Ø 15.5"
	var i3 = $('div .statprofile div:nth-child(3) .community').text()
	var i3AvgLocation = i3.indexOf('Ø')
	var i3Length = i3.length
	return i3.substring(i3AvgLocation+2, i3Length)
}

//battery charge status remaining
function batteryChargeStatusPercentage ($) {
	//"82 %66 mls82 mls"
	var i3Ranges = $('div .boxTeaserVS span').text()
	var i3RangesLength = i3Ranges.length
	var i3RangesPercentLocation = i3Ranges.indexOf('%')
	return i3Ranges.substring(0, i3RangesPercentLocation-1)
}

// battery miles remaining
function batteryChargeStatusMilesRemain ($) {
	//"82 %66 mls82 mls"
	var i3Ranges = $('div .boxTeaserVS span').text()
	var i3RangesLength = i3Ranges.length
	var i3RangesPercentLocation = i3Ranges.indexOf('%')
	var i3RangesMls1Location = i3Ranges.indexOf('mls')
	return i3Ranges.substring(i3RangesPercentLocation+1, i3RangesMls1Location-1)
}

function rexStatusPercentage ($) {
	// This isn't a perect match.  There appears to be a 3% error >50% and a <2% error <50%
	return  $('div:nth-child(5) .charge-bar').attr('data-charge')
}

// miles remaining on the rex
function rexStatusMilesRemain ($) {
	//"82 %66 mls82 mls"
	var i3Ranges = $('div .boxTeaserVS span').text()
	var i3RangesLength = i3Ranges.length
	var i3RangesPercentLocation = i3Ranges.indexOf('%')
	var i3RangesMls1Location = i3Ranges.indexOf('mls')
	return i3Ranges.substring(i3RangesMls1Location+3, i3RangesLength-4)
}
