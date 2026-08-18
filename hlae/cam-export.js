// cam-export.js - HLAE mirv-script for CS2
//
// Streams the live spectator camera to the qoax-broadcast-ar-cs2-middleware
// WebSocket bridge (see ../src/server.ts), which repacks it into a FreeD UDP
// packet for Unreal Engine 5 Live Link.
//
// Install: run scripts/link-hlae-snippet.ps1 (or copy this file manually) to
// place it at "%ProgramFiles(x86)%\HLAE\resources\AfxHookSource2\snippets\cam-export.js".

var WS_URL = 'ws://127.0.0.1:3000'; // mirv_script_load can't pass args, so edit this value directly to change the target
var RECONNECT_INTERVAL_MS = 2000;

var wsOutStream = null;
var connecting = false;
var lastConnectAttempt = 0;

function connect() {
    if (connecting) {
        return;
    }
    connecting = true;
    lastConnectAttempt = Date.now();

    mirv.connect_async(WS_URL)
        .then(function (connection) {
            mirv.message('Connected to FreeD middleware at ' + WS_URL + '\n');
            wsOutStream = connection.out;
            connecting = false;
        })
        .catch(function (err) {
            mirv.warning('WebSocket connection failed: ' + err + '\n');
            wsOutStream = null;
            connecting = false;
        });
}

connect();

// Hook into the engine's view render loop
mirv.onCViewRenderSetupView = function (e) {
    if (wsOutStream === null) {
        // Retry periodically instead of attempting a connection every frame
        if (!connecting && Date.now() - lastConnectAttempt >= RECONNECT_INTERVAL_MS) {
            connect();
        }
        return undefined;
    }

    var view = e.currentView;
    var camData = {
        x: view.x,
        y: view.y,
        z: view.z,
        pitch: view.rX, // CS2 maps Pitch to rX
        yaw: view.rY,   // CS2 maps Yaw to rY
        roll: view.rZ,  // CS2 maps Roll to rZ
        fov: view.fov
    };

    // wsOutStream.send() returns a Promise. We catch failures so a dropped
    // socket doesn't spam the game console every frame, and let the retry
    // logic above re-establish the connection.
    wsOutStream.send(JSON.stringify(camData)).catch(function () {
        wsOutStream = null;
    });

    // We must return undefined so we don't accidentally manipulate/lock the in-game camera
    return undefined;
};
