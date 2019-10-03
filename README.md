# oxdna-viewer
oxDNA configuration viewer 

The dev branch contains the newest features and is constantly being updated!  Generally dev is stable and will not crash too frequently.  If you want to try the bleeding edge features, ask the developers which branches are under active development.  For example, live relaxation is on jigglewiggle.

Github pages can only host the master branch, so to try the dev version out you will need to download it.

If you just download or clone and run index.html in a browser window, dist/ contains a set of compiled Javascript modules which will run.  However, if you wish to make any modifications to the code, you will need to recompile the typescript.

To use:
1) open index.html in any web browser

2) drag and drop a .dat and .top file pair

If you want to use the viewer as-is locally, simply download or clone the repository and open the index.html in a web browser (Chrome works best).  If you would like to make changes, you will need to make sure you have the following dependencies installed: Typescript, Node.js, and Three.js.  Here are some instructions to install the required packages and compile the code:

1) "git clone -b master https://github.com/sulcgroup/oxdna-viewer.git"

2) Download Typescript and Node.js 
   
   ts and npm ask for different name of node.js: one is node and another is nodejs, you may need to change the name of it accordingly or get an extra copy

3) "npm install --save @types/three" 
   
   If it goes wrong, open the package.json file and change "name", into "types/three-test" and try again
   
   Refer to https://thisdavej.com/node-newbie-error-npm-refusing-to-install-package-as-a-dependency-of-itself/

4) Go to oxdna-viewer folder

5) npm install --save @types/webvr-api
   
   These previous two steps install the necessary Typescript bindings for Three.js

6) tsc

   This is the command to run the typescript compiler.  Output directory and adding new files to the compiler can be found in tsconfig.json

   tsc needs to be run every time you make changes to the Typescript.  If you run tsc with the -w flag it will continuously watch for file changes.

7) The compiled Javascript will be in the dist/ directory

8) Open index.html in any browser (Chrome works best)
