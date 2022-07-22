function createVideo() {
    // Get canvas
    const canvas = document.getElementById("threeCanvas");
    // Get options:
    const format = document.querySelector('input[name="videoFormat"]:checked').value;
    const framerate = document.getElementById("videoFramerate").value;
    const videoType = document.getElementById("videoType").value;
    // Transparent background becomes black in videos
    const fixBackground = !scene.background && ['webm', 'gif'].includes(format);
    if (fixBackground) {
        scene.background = new THREE.Color(document.getElementById("backgroundColor").value);
    }
    let onComplete = () => {
        // Reset transparent background
        if (fixBackground) {
            scene.background = null;
        }
    };
    // Set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: videoType,
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });
    const button = document.getElementById("videoStartStop");
    button.innerText = "Stop";
    button.onclick = function () {
        capturer.stop();
        capturer.save();
        onComplete();
    };
    try {
        switch (videoType) {
            case "trajectory":
                createTrajectoryVideo(canvas, capturer, onComplete);
                break;
            case "lemniscate":
                let duration = document.getElementById("videoDuration").value;
                createLemniscateVideo(canvas, capturer, framerate, duration, onComplete);
                break;
        }
    }
    catch (e) {
        notify("Failed to capture video: \n" + e);
        capturer.stop();
    }
}
;
function createTrajectoryVideo(canvas, capturer, onComplete) {
    // Listen for configuration loaded events
    function _load(e) {
        e.preventDefault(); // cancel default actions
        capturer.capture(canvas);
        trajReader.nextConfig();
    }
    ;
    // Listen for last configuration event
    function _done(e) {
        document.removeEventListener('nextConfigLoaded', _load);
        document.removeEventListener('finalConfig', _done);
        capturer.stop();
        capturer.save();
        button.innerText = "Start";
        button.onclick = createVideo;
        if (onComplete)
            onComplete();
    }
    ;
    // Overload stop button so that we don't forget to remove listeners
    const button = document.getElementById("videoStartStop");
    button.onclick = _done;
    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);
    // Start capturing
    capturer.start();
    trajReader.nextConfig();
}
;
function createLemniscateVideo(canvas, capturer, framerate, duration, onComplete) {
    // Setup timing
    let tMax = 2 * Math.PI;
    let nFrames = duration * framerate;
    let dt = tMax / nFrames;
    // Preserve camera distance from origin:
    const d = Origin.distanceTo(camera.position);
    capturer.start();
    // Overload stop button so that we don't forget to remove listeners
    const button = document.getElementById("videoStartStop");
    button.onclick = function () { tMax = 0; };
    // Move camera and capture frames
    // This is not a for-loop since we need to use
    // requestAnimationFrame recursively.
    let t = 0;
    var animate = function () {
        if (t >= tMax) {
            capturer.stop();
            capturer.save();
            button.innerText = "Start";
            button.onclick = createVideo;
            if (onComplete)
                onComplete();
            return;
        }
        requestAnimationFrame(animate);
        camera.position.set(d * Math.cos(t), d * Math.sin(t) * Math.cos(t), d * Math.sqrt(Math.pow(Math.sin(t), 4)));
        camera.lookAt(Origin);
        t += dt;
        render();
        capturer.capture(canvas);
    };
    animate();
}
;
function nyancat(seq = "NYANCAT", framerate = 24, duration = 5) {
    const elems = edit.createStrand(seq, true);
    centerAndPBC(elems);
    camera.position.set(10, 0, 0);
    scene.background = new THREE.Color().setHex(0x043864);
    backboneColors[0].setHex(0xfa6dfd);
    backboneColors[1].setHex(0xfcce9d);
    const arrows = document.getElementById("arrowToggle");
    arrows.checked = false;
    toggleArrows(arrows);
    updateColoring();
    const s = new Set(elems[0].strand.getMonomers());
    const capturer = new CCapture({
        format: 'gif', framerate: framerate,
        name: seq, display: true, workersPath: 'ts/lib/'
    });
    let nFrames = duration * framerate;
    capturer.start();
    let t = 0;
    var animate = function () {
        if (t >= nFrames) {
            capturer.stop();
            capturer.save();
            scene.background = null;
            return;
        }
        if (t % 10 == 0) {
            edit.setSequence(s, seq, true);
        }
        requestAnimationFrame(animate);
        controls.stepAroundAxis(new THREE.Vector3(1, 0, 0), -2 * Math.PI / framerate);
        render();
        capturer.capture(canvas);
        t++;
    };
    animate();
}
;
