 
/* 
	Description
   
	Visualize real-time earthquake data from the United States Geological Survey (USGS) 
	feed about the location of earthquakes and their magnitude. 

	Notes  
   
	"GeoJSON" is a format for encoding a variety of geographic data structures. 
	A "GeoJSON" object may represent a geometry, a feature, or a collection of features. 
	"GeoJSON" uses the "JSON" standard. The "GeoJSONP" feed uses the same "JSON" response, but 
	the "GeoJSONP" response is wrapped inside the function call : "eqfeed_callback".

	References 
   
	* https://earthquake.usgs.gov/earthquakes/feed/       
	* https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
*/

var map;

/* -------------------------------------------------------------------------------------------------- */

function initMap() 
{	
	$( '#preloader' ).show( 0 );
	
	map = new google.maps.Map( document.getElementById( 'map' ), {
		zoom: 2,
		center: { lat: 37.983810, lng: 23.727539 },
		mapTypeId: 'terrain'
	});

	/* Create a <script> tag and set the "USGS" URL as the source */
	var script = document.createElement( 'script' );

	/* Download "GeoJSON" stored at the selected URL.
	 * The earthquake data in "JSONP" format */
	script.src = ( $( "select option:selected" ).val() );
	
	document.getElementsByTagName( 'head' )[ 0 ].appendChild( script );

	/* Add a style to the Data Layer, which calls the "getCircle()" function.
	 * Create a custom image (i.e. a circle) for the point, that is the epicentre of 
	 * every earthquake location, instead of the default red marker */
	map.data.setStyle( function( feature ) {
		var magnitude = feature.getProperty( 'mag' );
		return {
			icon: getCircle( magnitude )
		};
	});

	/* Create an "infowindow" object to use later */
	var infowindow = new google.maps.InfoWindow();

	/* Create a "listener" that will wait for the user to click an earthquake point,
	 * and then display the "infowindow" with details about that earthquake */
	map.data.addListener( 'click', function( event ) {
		/* In the "GeoJSON" feature that was clicked, get the "place", (epoch) "time", and "mag" attributes */
		var place = event.feature.getProperty( "place" );
		var magnitude = event.feature.getProperty( "mag" );
		var time = ( new Date( event.feature.getProperty( 'time' ))).toUTCString();
		/* Combine "place", "magnitude" and "time", inserting additional text between them */
		var info = "<b>place</b> : " + place + "<br/><b>magnitude</b> : " + magnitude + "<br/><b>time</b> : " + time; 
		/* Show the html variable in the "infowindow" */
		infowindow.setContent( info ); 
		/* Anchor the "infowindow" at the marker */
		infowindow.setPosition( event.feature.getGeometry().get() );
		/* Move the "infowindow" up slightly to the top of the marker icon */		  
		// infowindow.setOptions( { pixelOffset: new google.maps.Size( 0, -30 ) } );
		/* Create a popup "infowindow", from the "GeoJSON" data (USGS earthquake feed); make the info window visible, 
		 * calling the "open()" method on the "infowindow", passing it the "Map" on which to open. By default, an 
		 * "infowindow" remains open until the user clicks the close control (a cross at top right of the info window) */ 
		infowindow.open( map );
	});		
}  

/* -------------------------------------------------------------------------------------------------- */
/* 
	Draw circles (or any other shape) with sizes that are relative to the magnitude of an earthquake by using symbols. 
	In this way, powerful earthquakes are represented as the largest circles on the map. The circle size increases 
	with the magnitude of an earthquake at that particular location. 
	
	The magnitude property of the earthquake is passed to this function.
	Return that circle back to be used as the earthquake's custom marker : @type {google.maps.Data.StyleOptions}
*/
function getCircle( magnitude ) 
{
	return {
		path: google.maps.SymbolPath.CIRCLE,
		fillColor: 'red',
		fillOpacity: .2,
		scale: Math.pow( 2, magnitude ) / 2,
		strokeColor: 'white',
		strokeWeight: .5
	};
}

/* -------------------------------------------------------------------------------------------------- */
/* 
	The "USGS GeoJSONP" data response is wrapped inside the callback function call referenced in the 
	"jsonp" file : "eqfeed_callback"
*/
function eqfeed_callback( results ) 
{	
	if ( results && results.metadata && results.metadata.count > 0 )
	{
		map.data.addGeoJson( results );
		
		$( '#preloader' ).hide( 0 );
	}
	else
	{
		$( '#preloader' ).hide( 0 );
		
		error = "No data to display !";
		
		if ( results && results.metadata && results.metadata.title && results.metadata.title.trim().length > 0 )
			error = results.metadata.title.trim() + " :<br> " + error;
		
		$( document ).ready( function() {	
			/* This event fires immediately when the 'show' instance method is called */
			$( '#about' ).on( 'show.bs.modal', function ( event ) {
				/* Update the modal's content. We'll use jQuery here */ 
				var modal = $( this );
				modal.find( '.modal-title' ).text( 'earthquake.usgs.gov feed' );
				modal.find( '.modal-body p' ).html( error );
			});
			/* Activate the modal with JavaScript */	
			$( "#about" ).modal();
		});
	}
}

/* -------------------------------------------------------------------------------------------------- */
