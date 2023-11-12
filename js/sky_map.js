
/* 
	Fetch a sky map (astro viewer) for a specific location input by the user.
	* The user feeds the application with the name of his/her observing location, e.g. a specific city.
	* Then the application makes use of the proper Google APIs, retrieving the necessary information, e.g. the
	  location coordinates [ lat, long ]. 
	* Finally, the application submits a http GET request with the proper query parameters fetching the sky
      map for the input location; sky map built by Dirk Matussek on server side.
*/

/*  Initialize application by fetching the sky map of Athens, Greece; set-up the proper source address.
    Why this one ? Because it is my home city @ lat: 37.976, lon: 23.735 */
var sky_map_src = "https://astroviewer.net/av/widgets/skymap-av4-widget.php?lon=23.735&lat=37.976&deco=16415&bgColor=ffffff&lang=en&size=600&name=Athens&tz=Europe/Athens";

// Set the source attribute of the sky map element after the document (DOM) is loaded.
$( document ).ready( function() {
	$( '#sky_map' ).attr( 'src', sky_map_src );
});	

/* -------------------------------------------------------------------------------------------------- */

// Callback function.
function sky_map() {
	// A user can type the name of his/her observing location, such as the name of a city. 
	var location = document.getElementById( 'location' );
	// Use the Place "Autocomplete" widget to provide a type-ahead search box.
	var location_autocomplete = new google.maps.places.Autocomplete( location );
		
	google.maps.event.addListener( location_autocomplete, 'place_changed', function() {
		// When the user selects an "Autocomplete" result, a "getPlace()" request is being sent.
		var place = location_autocomplete.getPlace();
		
		// User entered the name of a "Place" that was not suggested and
		// pressed the "Enter" key, or the "Place Details" request failed.
		if ( !place.geometry ) {												
			$( "#about" ).modal();
			$( ".modal-body p" ).html( "No details available for input location : '" + place.name + "'" );
			
			return;
		}
		
		// The "place" has a geometry; save location's coordinates ( latitude, longitude ) and its name ( URL encoded ).
		var lat  = encodeURI( place.geometry.location.lat().toFixed( 3 ) );
		var lon  = encodeURI( place.geometry.location.lng().toFixed( 3 ) ); 
		var name = encodeURI( place.formatted_address );
		
		// Current timestamp in seconds.
		const timestamp = Math.floor( Date.now() / 1000 ); 
		
		// HTTP request to the Time-Zone API to get back the time-zone id of the input location.
		const url = "https://maps.googleapis.com/maps/api/timezone/json?" + 
			"location=" + lat + "%2C" + lon +
			"&timestamp=" + timestamp + 
			"&key=AIzaSyDlA5DFMdvjfPlzq51CnGsyJK8aUWS1sMo";

		let timeZone;
		
		// Make an synchronous HTTP request to the Time-Zone API to get back the time-zone id of the input location.
		var xhr = new XMLHttpRequest();
		xhr.open( 'GET', url, false );
		xhr.send();

		if ( xhr.status === 200 ) {
			// Parse the JSON response.
			var data = JSON.parse( xhr.responseText ); 
			// Access the time-zone id of the input location in the JSON response.		
			timeZone = data.timeZoneId;
		} 
		else {
			console.error( 'Request failed : ', xhr.status, xhr.statusText );
		}				
		
		// Set-up the proper source address for the input location.
		sky_map_src = "https://astroviewer.net/av/widgets/skymap-av4-widget.php?" + 
			"lon=" + lon + 
			"&lat=" + lat + 
			"&deco=16415" +
			"&bgColor=ffffff" +
			"&lang=en" + 
			"&size=600" + 
			"&name=" + name + 
			"&tz=" + timeZone;
		
		// Set the source attribute of the sky map element.
		$( '#sky_map' ).attr( 'src', sky_map_src );
	})
}

/* -------------------------------------------------------------------------------------------------- */
