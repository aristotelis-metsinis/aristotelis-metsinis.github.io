
/* 
	Fetch a weather forecast (Meteoblue) for a specific location input by the user.
	* The user feeds the application with the name of his/her location, e.g. a specific city.
	* Then the application makes use of the proper Google APIs, retrieving the necessary information, e.g. the
	  location coordinates [ lat, long ]. 
	* Finally, the application submits a http GET request with the proper query parameters fetching the weather 
      forecast for the input location; weather forecast provided by Meteoblue on server side.
*/

/*  Initialize application by fetching the weather forecast of Athens, Greece; set-up the proper source address.
    Why this one ? Because it is my home city @ lat: 37.976, lon: 23.735 */
var weather_forecast_src ="https://www.meteoblue.com/en/weather/maps/widget/athens_greece_264371?windAnimation=0&windAnimation=1&gust=0&gust=1&satellite=0&satellite=1&cloudsAndPrecipitation=0&cloudsAndPrecipitation=1&temperature=0&temperature=1&sunshine=0&sunshine=1&extremeForecastIndex=0&extremeForecastIndex=1&geoloc=fixed&tempunit=C&windunit=km%252Fh&lengthunit=metric&zoom=5&autowidth=auto";

var weather_forecast_daily_src ="https://www.meteoblue.com/en/weather/widget/daily/athens_greece_264371?geoloc=fixed&days=4&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&precipunit=MILLIMETER&coloured=coloured&pictoicon=0&pictoicon=1&maxtemperature=0&maxtemperature=1&mintemperature=0&mintemperature=1&windspeed=0&windspeed=1&windgust=0&windgust=1&winddirection=0&winddirection=1&uv=0&uv=1&humidity=0&humidity=1&precipitation=0&precipitation=1&precipitationprobability=0&precipitationprobability=1&spot=0&pressure=0&pressure=1&layout=light";

// Set the source attribute of the weather forecast element after the document (DOM) is loaded.
$( document ).ready( function() {
	$( '#weather_forecast' ).attr( 'src', weather_forecast_src );
	$( '#weather_forecast_daily' ).attr( 'src', weather_forecast_daily_src );
});	

/* -------------------------------------------------------------------------------------------------- */

// Callback function.
function weather_forecast() {
	// A user can type the name of his/her location, such as the name of a city. 
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
		
		// The "place" has a geometry; save location's coordinates ( latitude, longitude ).
		var lat  = encodeURI( place.geometry.location.lat().toFixed( 3 ) );
		var lon  = encodeURI( place.geometry.location.lng().toFixed( 3 ) ); 
		
		async function retrieveLocationInformation( latitude, longitude ) {
			try {
				const response = await fetch( `https://www.meteoblue.com/en/server/search/query3?query=${lat}%20${lon}&apikey=DEMOKEY`, );
				if ( !response.ok ) {			  
					$( "#about" ).modal();
					$( ".modal-body p" ).html( "HTTP error retrieving information for input location '" + place.name + "' : " +  response.status );
			
					return;				  
				}
				const data = await response.json();
				return data;
			} catch ( error ) {			
				$( "#about" ).modal();
				$( ".modal-body p" ).html( "Error retrieving information for input location '" + place.name + "' : " +  error );
			
				return;			
			}
		}
			
		const locationInformation = retrieveLocationInformation( lat, lon );
		locationInformation.then( ( data ) => { 

			// Set-up the proper source address for the input location.
			weather_forecast_src = "https://www.meteoblue.com/en/weather/maps/widget/" + data.results[0].url +"?windAnimation=0&windAnimation=1&gust=0&gust=1&satellite=0&satellite=1&cloudsAndPrecipitation=0&cloudsAndPrecipitation=1&temperature=0&temperature=1&sunshine=0&sunshine=1&extremeForecastIndex=0&extremeForecastIndex=1&geoloc=fixed&tempunit=C&windunit=km%252Fh&lengthunit=metric&zoom=5&autowidth=auto";
			
			weather_forecast_daily_src = "https://www.meteoblue.com/en/weather/widget/daily/" + data.results[0].url + "?geoloc=fixed&days=4&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&precipunit=MILLIMETER&coloured=coloured&pictoicon=0&pictoicon=1&maxtemperature=0&maxtemperature=1&mintemperature=0&mintemperature=1&windspeed=0&windspeed=1&windgust=0&windgust=1&winddirection=0&winddirection=1&uv=0&uv=1&humidity=0&humidity=1&precipitation=0&precipitation=1&precipitationprobability=0&precipitationprobability=1&spot=0&pressure=0&pressure=1&layout=light";			
			
			// Set the source attribute of the weather forecast element.
			$( '#weather_forecast' ).attr( 'src', weather_forecast_src );
			$( '#weather_forecast_daily' ).attr( 'src', weather_forecast_daily_src );
		});
	})
}

/* -------------------------------------------------------------------------------------------------- */
