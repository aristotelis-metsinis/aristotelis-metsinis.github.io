
// Ref @ https://alansimpson.thinkific.com/courses/create-a-hit-counter-with-firebase-and-javascript

if ( location.hostname.toLowerCase() != 'aristotelis-metsinis.github.com' ) {
	// Initialization information to configure the Firebase JavaScript SDK to use the Realtime Database. 
	// The Firebase Realtime Database is a cloud-hosted database. Data is stored as JSON and synchronized 
	// in realtime to every connected client.
	var config = {
		apiKey: "AIzaSyCEiCdSzg9hV-e85LUmpUThVLxB0njxmsI",
		authDomain: "websitehitcounter-e178f.firebaseapp.com",
		databaseURL: "https://websitehitcounter-e178f.firebaseio.com",
		projectId: "websitehitcounter-e178f",
		storageBucket: "websitehitcounter-e178f.appspot.com",
		messagingSenderId: "630555052222"
	};
	firebase.initializeApp( config );
	
	// rootRef is a reference to the whole Firebase database to read or write data from the database.
	const rootRef = firebase.database().ref();
	// pageCountRef is just the node that tracks hits.
	const pageCountRef = rootRef.child( "pageCounts" );
					
	// Get the key and current hit count for the page (if it exists).
	// Use "Promise" to know when the write is committed to the database.
	let getHistory = new Promise( function( resolve, reject ) {
		// Create an object to store a copy of the saved db data.
		let obj = {};
		// A snapshot of data without listening for changes - 
		// Use "once()" method; it triggers once and then does not trigger again - data needs to 
		// be loaded once and isn't expected to change frequently or require active listening.
		pageCountRef.orderByChild( "page" ).equalTo( location.pathname ).once( "value", function( snapshot ) {
			snapshot.forEach( function( child ) {
				obj = {
					key: child.key,
					count: child.val().count
				}
			});
			if ( obj ) {
				resolve( obj );
			}
			else {
				reject( error );
			}
			// console.log( obj.key );
			// console.log( obj.count );
		});
	})
	
	// When getHistory promise resolves, the key is either undefined (page not in the database)
	// or the key is a string that uniquely identifies the page in the database.
	getHistory.then( function( fromResolve ) {
		var key = fromResolve.key;
		var pastcounts = fromResolve.count;
		// If key is undefined, create a new key for this database item.
		if ( key == undefined ) {
			key = pageCountRef.push().key;
			pastcounts = 0;
		}
		// Total hits to date.
		counts = pastcounts + 1;
		// Gather info to post.
		var postData = {
			page: location.pathname,
			count: counts,
			lastVisit: firebase.database.ServerValue.TIMESTAMP,
			lastreferrer: document.referrer
		}
		var updates = {};
		updates[ "/pageCounts/" + key ] = postData;
		// Simultaneously write to specific children of a node without overwriting other child nodes 
		// by specifying a path for the key with a completion callback - called when  
		// the write has been committed to the database. If the call was 
		// unsuccessful, the callback is passed an error object indicating why the failure occurred.
		rootRef.update( updates, function( error ) {
			if ( error ) {
				console.log( error );
			} 
		});
		
		// Show hit counter.
		// console.log( counts );
		var digits = counts.toString().split( "" );	
		digits.forEach( function format( digit, index ) { 
			document.getElementById( "hit_counter" ).innerHTML = document.getElementById( "hit_counter" ).innerHTML + "<span class='hit_counter'>" + digit + "</span>"; 
		});
		
	}).catch( function( fromReject ) {
		if ( fromReject ) {
			console.log( fromReject );
		} 
	});
}