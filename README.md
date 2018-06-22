# oxdna-viewer
oxDNA configuration viewer 

The dev branch contains the newest features and is constantly being updated!

Github pages can only host the master branch, so to try the dev version out you will need to download it.

If you just download or clone and run index.html in a browser window, dist/ contains a set of compiled Javascript modules which will run.  However, if you wish to make any modifications to the code you will need to recompile the typescript.

To use:
1) Open index.html in browser
2) Drag .dat and .top files onto screen

Steps to install and compile:
1) "git clone -b dev https://github.com/sulcgroup/oxdna-viewer.git"
2) Download Typescript and Node.js
3) "npm install --save @types/three"
4) Go to oxdna-viewer folder
5) "tsc"
6) The compiled Javascript will be in the dist/ directory
