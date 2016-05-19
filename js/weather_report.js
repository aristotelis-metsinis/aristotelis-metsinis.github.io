var geocoder;    
var autocomplete;

function initialize() 
{
	geocoder = new google.maps.Geocoder();
	
	autocomplete = new google.maps.places.Autocomplete( /** @type {HTMLInputElement} */ document.getElementById( 'forecast_address' ) );
}

function locate_address() 
{		
	var address = document.getElementById( 'forecast_address' ).value;
	
	geocoder.geocode( { 'address': address }, function( results, status ) 
	{
		if ( status == google.maps.GeocoderStatus.OK ) 
		{	
			var latitude = results[ 0 ].geometry.location.lat(); 	
			var longitude = results[ 0 ].geometry.location.lng(); 	 
					
			var uri = "http://forecast.io/embed/#lat=" + latitude + "&lon=" + longitude + "&name=" + encodeURI( address ) + "&text-color=black&color=#e1ddce&font=%27Lucida Grande%27%2CVerdana%2CLucida%2CHelvetica%2CArial%2Csans-serif&units=ca";
															
			document.getElementById( "forecast_div" ).innerHTML = "<iframe id='forecast_embed' type='text/html' frameborder='0' height='245' width='100%' src='" + uri + "'></iframe>";
		} 
		else 
		{		
			document.getElementById( "forecast_div" ).innerHTML = "Error: weather report cannot be displayed because location detection was not successful for the input address due to the following reason: \"" + status + "\".";								
		}			
	});		
}
	
google.maps.event.addDomListener( window, 'load', initialize );
