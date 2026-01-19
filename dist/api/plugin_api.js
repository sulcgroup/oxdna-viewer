// let's define a storage structure for the plugin API
// it will sit in local storage and load the code for the individual plugins named as key 
// and the code as value packed away in a JSON object hidden at the key "plugins" in local storage
// this is the object that will be stored in local storage
// it will contain the code for the individual plugins
// the key will be the name of the plugin, the value will be the code
let plugins = {};
// this function will load the plugins from local storage
// it will be called at the beginning of the program
function loadPlugins() {
    let pluginsString = localStorage.getItem("plugins");
    if (pluginsString && pluginsString != "[object Object]") {
        plugins = JSON.parse(pluginsString);
    }
    // if there are no plugins in local storage, we will create an empty object
    else {
        plugins = {}; //"test": plugin_code};
    }
    //iterate over all the plugins and load them
    for (let plugin in plugins) {
        eval(plugins[plugin]);
    }
}
// this function will save the plugins to local storage (it will be called any time we add a new plugin)
function savePlugins() {
    localStorage.setItem("plugins", JSON.stringify(plugins));
}
function addPlugin(name, plugin_code) {
    plugins[name] = plugin_code;
    eval(plugin_code);
    savePlugins();
}
loadPlugins();
