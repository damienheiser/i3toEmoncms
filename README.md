# i3toEmoncms
Gathers data from B M W Connected Drive for B M W i3 reported details and post to emoncms.  Only works with the USA Connected Drive website.

## Assumptions
This is a **hobby project created for educational use**, for my own proof of concept that I could do this.  Other projects on git hub take advantage of the API directly, but the iOS apps are locked in such a way that I cannot intercept the communications.  Therefore, I decided to use the Connected Drive website and pull all of the data directly from it.  There are probably many things that will break this in the future.

## Theory of Operation
	- Obtains JS Session Cookie
	- Sends Login Parameters with Session Cookie
	- Retrieves HTML of Statistics Page, returns a Cheerio object
 	- Process each atomic data point, add to JSON object
 	- Send JSON object to emoncms

## Configuration
Modify the values in loginObject at the top of the i3toEmoncms.js file. This would be your B M W Connected Drive username and password.  Keep this information secure on your local machine, these are in plain text duh.  In addition, you can choose to have this script update emoncms with every time it runs, or only with changes to data.  Set the updateEmonCmsNoChange and updateEmonCmsIfDriving variables to true.
```
var updateEmonCmsNoChange = false // true will always update EmonCMS, even if no data changes.
var updateEmonCmsIfDriving = false // true will update EmonCMS when driving, corrects for undefined and zero values

var loginObject = {
	username: 'user%40domain.com', //Replace @ with %40 (ie. user%40domain.com)
	password: 'YOURPASSWORD', // your password
	emonCmsURL: 'https://www.emoncms.org/', //emoncms post url
	emonCmsAPIKey : '' // your emoncms.org write key
}
```
## Prerequisites
You'll need to install cheerio, request, levelup, leveldown, and util using npm in the same directory that you're running this (yes, I didn't make a package... this isn't for you it's for me).  Also, you need to have at least a little bit of an idea what's going on here.

	- npm install cheerio
	- npm install request
	- npm install levelup
	- npm install leveldown
	- npm install util

## Use
in a terminal '**node i3toEmoncms.js**'

## Expected Output 
In this output, updateEmonCmsNoChange and updateEmonCmsIfDriving were set to true.
```
getting some delicious cookies...
attempting to login...
successful login!
retrieving statistics
got em...
parsing data from nasty ass html...
posting to emoncms!
{ lastTrip: '18.6',
  lastTripEfficiency: '46',
  electricMileage: '29168.9',
  electricMileageCommunityMax: '82384.3',
  electricMileageCommunityAverage: '18697.7',
  electricDistanceDrivenSinceLastCharged: '18.6',
  electricDistanceDrivenSinceLastChargedMax: '70.8',
  electricDistanceDrivenSinceLastChargedCommunityMax: '122.0',
  electricDistanceDrivenSinceLastChargedCommunityAverage: '75.0',
  consumptionmikWhTrip: '4.1',
  consumptionmikWhTotalAverage: '3.5',
  consumptionmikWhCommunityAverage: '3.9',
  recuperationmikWhTrip: '15.5',
  recuperationmikwhTotalAverage: '19.1',
  batteryChargeStatusPercentage: '76',
  batteryChargeStatusMilesRemain: '51',
  rexStatusPercentage: '100',
  rexStatusMilesRemain: '72',
  recuperationmikwhCommunityAverage: '15.5' }
last: as of 12/08/2017, 10:48 AM | now: as of 12/08/2017, 10:48 AM
'ok'
Writing to db... waiting for promises to be returned.
ok
```
In this output, updateEmonCmsNoChange and updateEmonCmsIfDriving were set to false. (Default)
```
getting some delicious cookies...
attempting to login...
successful login!
retrieving statistics
got em...
parsing data from nasty ass html...
Current Update and Last Update match... not updating
```

## Proposed Use
Run as a cron job every 5 minutes, the resolution seems to be at least that high for getting battery charge state during active charging.

## API Sommelier
This pairs really well with an IFTTT integration using the B M W Labs IFTTT Connected Drive widget.  Allowing you to retrieve overall Mileage, parking and driving events (going over a certain speed, leaving/entering a geofence, reduction of travel range, changing to park or drive).
