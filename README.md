oxDNA-Viewer-Master

[Try it](https://sulcgroup.github.io/oxdna-viewer/)

A web app for viewing oxDNA configuration files.  Simply drag and drop your .dat and .top files onto the browser window, or select the files in the "Upload local files" dialogue box.

The version running on the "Try it" link is the simple master branch.  If you want to see the latest updates with full functionality, please checkout or download the dev branch


If you want to use the viewer as-is locally, simply download or clone the repository and open the index.html in a web browser (Chrome works best).  If you would like to make custom changes, you will need to make sure you have the following dependencies installed: Typescript, Node.js, and Three.js.  Here are some instructions to install the required packages and compile the code:

1) "git clone -b master https://github.com/sulcgroup/oxdna-viewer.git"
2) Download Typescript and Node.js 
   //ts and npm ask for different name of node.js: one is node and another is nodejs, you may need to change the name of it accordingly or get an extra copy
3) "npm install --save @types/three" 
   //If it goes wrong, open the package.json file and change "name", may be into "types/three-test" and try again
   //Refer to https://thisdavej.com/node-newbie-error-npm-refusing-to-install-package-as-a-dependency-of-itself/
4) Go to oxdna-viewer folder
5) npm install --save @types/webvr-api
   //These previous two steps install the necessary Typescript bindings for Three.js
6) "tsc"
   //This is the command to run the typescript compiler.  Compiler instructions can be found in tsconfig.json
   //tsc needs to be run every time you make changes to the Typescript
7) The compiled Javascript will be in the dist/ directory
8) Open index.html in any browser (Chrome works best)

