
/* 
	Fetch a sky map (astro viewer) for a specific location input by the user.
	* The user feeds the application with the name of his/her observing location, e.g. a specific city.
	* Then the application makes use of the proper Google APIs, retrieving the necessary information, e.g. the
	  location coordinates [ lat, long ]. 
	* Finally, the application submits a http GET request with the proper query parameters fetching the sky
      map for the input location; sky map built by Dirk Matussek on server side.
*/

/*  Initialize application by fetching the sky map of Athens, Greece; set-up the proper image source address.
    Why this one ? Because it is my home city @ lat: 37.983810, lng: 23.727539 */
var sky_map_src = "http://www.astrobot.eu/skymapserver/skymap?type=png&size=580&colorset=0&lang=en&lon=23.7275&lat=37.9838&city=Athens%2C+Greece+%3A%0D%0A37.9838%C2%B0+N%2C+23.7275%C2%B0+E&timezone=UTC&deco=16399";

// Set the source attribute of the sky map image element after the document (DOM) is loaded.
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
		var lat  = encodeURI( place.geometry.location.lat().toFixed( 4 ) );
		var lon  = encodeURI( place.geometry.location.lng().toFixed( 4 ) ); 
		var city = encodeURI( place.formatted_address )+ "+%3A%0D%0A" + lat + "%C2%B0+N%2C+" + lon + "%C2%B0+E";
		
		// Set-up the proper image source address for the input location.
		sky_map_src = "http://www.astrobot.eu/skymapserver/skymap?type=png&size=580&colorset=0&lang=en&lon=" + lon + "&lat=" + lat + "&city=" + city + "&timezone=UTC&deco=16399";
		
		// Set the source attribute of the sky map image element.
		$( '#sky_map' ).attr( 'src', sky_map_src );
	})
}

/* -------------------------------------------------------------------------------------------------- */
