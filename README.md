# i3toEmoncms
Gathers data from B M W Connected Drive for B M W i3 reported details and post to emoncms

# Assumptions
This is a hobby project, for my own proof of concept that I could do this.  Other projects on git hub take advantage of the API directly, but the iOS apps are locked in such a way that I cannot intercept the communications.  Therefore, I decided to use the Connected Drive website and pull all of the data directly from it.  There are probably many things that will break this in the future.

# Theory of Operation
1 Obtains JS Session Cookie
2 Sends Login Parameters with Session Cookie
3 Retrieves HTML of Statistics Page, returns a Cheerio object
4 Process each atomic data point, add to JSON object
5 Send JSON object to emoncms

# Configuration
Modify the values in loginObject at the top of the i3toEmoncms.js file. This would be your B M W Connected Drive username and password.  Keep this information secure on your local machine, these are in plain text duh.

var loginObject = {
	username: 'user%40domain.com', //Replace @ with %40 (ie. user%40domain.com)
	password: 'YOURPASSWORD', // your password
	emonCmsURL: 'https://www.emoncms.org/', //emoncms post url
	emonCmsAPIKey : '' // your emoncms.org write key
}
# Prerequisites
You'll need to install cheerio, request, request-cookies using npm in the same directory that you're running this (yes, I didn't make a package... this isn't for you it's for me)

1 npm install cheerio
2 npm install request
3 npm install request-cookies

# Use
in a terminal 'node i3toEmoncms.js'

# Expected Output
getting some delicious cookies...
attempting to login...
successful login!
retrieving statistics
got em...
parsing data from nasty ass html...
posting to emoncms!
{ lastTrip: '18.6',
  lastTripEfficiency: '76',
  electricMileage: '29095.6',
  electricMileageCommunityMax: '82206.5',
  electricMileageCommunityAverage: '18653.3',
  electricDistanceDrivenSinceLastCharged: '18.6',
  electricDistanceDrivenSinceLastChargedMax: '70.8',
  electricDistanceDrivenSinceLastChargedCommunityMax: '122.0',
  electricDistanceDrivenSinceLastChargedCommunityAverage: '75.0',
  consumptionmikWhTrip: '5.3',
  consumptionmikWhTotalAverage: '3.5',
  consumptionmikWhCommunityAverage: '3.9',
  recuperationmikWhTrip: '15.5',
  recuperationmikwhTotalAverage: '19.1',
  batteryChargeStatusPercentage: '81',
  batteryChargeStatusMilesRemain: '60',
  rexStatusPercentage: '100',
  rexStatusMilesRemain: '78',
  recuperationmikwhCommunityAverage: '15.5' }
'ok'
ok


# Proposed Use
I have this running as a cron job every 5 minutes, the resolution seems to be at least that high for getting battery charge state during active charging.

# API Sommelier
This pairs really well with an IFTTT integration using the B M W Labs IFTTT Connected Drive widget.  Allowing you to retrieve overall Mileage, parking and driving events (going over a certain speed, leaving/entering a geofence, reduction of travel range, changing to park or drive).
