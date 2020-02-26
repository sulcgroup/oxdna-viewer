function createVideo() {
    // Get canvas
    const canvas = <HTMLCanvasElement>document.getElementById("threeCanvas");

    // Get options:
    const format = (<HTMLInputElement>document.querySelector('input[name="videoFormat"]:checked')).value;
    const framerate = (<HTMLInputElement>document.getElementById("videoFramerate")).value;
    const videoType = <HTMLInputElement>document.getElementById("videoType");

    // Set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: videoType.value,
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });

    const button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.innerText = "Stop";
    button.onclick = function () {
        capturer.stop();
        capturer.save();
    }
    try {
        switch (videoType.value) {
            case "trajectory":
                createTrajectoryVideo(canvas, capturer);
                break;
            case "lemniscate":
                let duration = (<HTMLInputElement>document.getElementById("videoDuration")).value;
                createLemniscateVideo(
                    canvas, capturer,
                    <number><unknown>framerate,
                    <number><unknown>duration
                );
                break;
        }
    } catch (e) {
        notify("Failed to capture video: \n" + e);
        capturer.stop();
    }
};

function createTrajectoryVideo(canvas, capturer) {
    // Listen for configuration loaded events
    function _load(e) {
        e.preventDefault(); // cancel default actions
        capturer.capture(canvas);
        trajReader.nextConfig();
    };

    // Listen for last configuration event
    function _done(e) {
        document.removeEventListener('nextConfigLoaded', _load);
        document.removeEventListener('finalConfig', _done);
        capturer.stop();
        capturer.save();
        button.innerText = "Start";
        button.onclick = createVideo;
        return;
    };

    // Overload stop button so that we don't forget to remove listeners
    const button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.onclick = _done;

    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);

    // Start capturing
    capturer.start();
    trajReader.nextConfig();
};

function createLemniscateVideo(canvas, capturer, framerate:number, duration:number) {
    // Setup timing
    let tMax = 2 * Math.PI;
    let nFrames = duration * framerate;
    let dt = tMax / nFrames;

    // Preserve camera distance from origin:
    const d = Origin.distanceTo(camera.position);

    capturer.start();

    // Overload stop button so that we don't forget to remove listeners
    const button = <HTMLInputElement>document.getElementById("videoStartStop");
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
            return;
        }
        requestAnimationFrame(animate);
        camera.position.set(
            d * Math.cos(t),
            d * Math.sin(t) * Math.cos(t),
            d * Math.sqrt(Math.pow(Math.sin(t), 4))
        );
        camera.lookAt(Origin);
        t += dt;
        render();
        capturer.capture(canvas);
    }
    animate();
};