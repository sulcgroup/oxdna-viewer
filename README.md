oxDNA-Viewer-Master

[Try it](https://sulcgroup.github.io/oxdna-viewer/)

A web app for viewing oxDNA configuration files.  Simply drag and drop your .dat and .top files onto the browser window, or select the files in the "Upload local files" dialogue box.

The code is written in Typescript and rendered using Three.js, so if you want to hack it, you're going to have to download those packages.  Here are some instructions to install and compile this code:

1) "git clone -b master https://github.com/sulcgroup/oxdna-viewer.git"
2) Download Typescript and Node.js 
   //ts and npm ask for different name of node.js: one is node and another is nodejs, you may need to change the name of it accordingly or get an extra copy
3) "npm install --save @types/three" 
   //If it goes wrong, open the package.json file and change "name", may be into "types/three-test" and try again
   //Refer to https://thisdavej.com/node-newbie-error-npm-refusing-to-install-package-as-a-dependency-of-itself/
4) Go to oxdna-viewer folder
5) npm install --save @types/webvr-api
5) "tsc"
6) The compiled Javascript will be in the dist/ directory
7) Open index.html in any browser 

