var path = require("path");
var fs = require("fs");
var AdmZip = require("adm-zip");
var utils = require("./utils");

/**
 * Searches the resources folder for a zip file with the name equal
 * to the FCMResourcesFile preference value and resturns an absolute path
 * if found.
 *
 * @param {String} resourcesFolder - the absolute path to the expected resources folder
 * @param {String} prefZipFilename - the expected name of the zip file
 * as set on the FCMResourcesFile prefenrece
 * @returns {string} absolute path to the zip file
 *
 */
function getZipFile(resourcesFolder, prefZipFilename) {
    try {
        console.log(resourcesFolder);

        var dirFiles = fs.readdirSync(resourcesFolder);
        var zipFile;
        dirFiles.forEach(function (file) {
            if (file.match(/\.zip$/)) {
                var filename = path.basename(file, ".zip");
                if (filename === prefZipFilename) {
                    zipFile = path.join(resourcesFolder, file);
                }
            }
        });
        return zipFile;
    } catch (error) {
        return undefined;
    }
}

/**
 * Attempts to unzip the zip file
 * @param {string} zipFile Absolute path to the etracted zip
 * @param {string} unzippedTargetDir Absolutepath to where the
 * uncompressed content is going to be placed
 * @param {string} prefZipFilename The name of the zip file
 * @returns {string} Absolute path to the folder containing
 * the uncompressed content of the zip file
 */
function unzip(zipFile, unzippedTargetDir, prefZipFilename) {
    var zip = new AdmZip(zipFile);
    var targetDir = path.join(unzippedTargetDir, prefZipFilename);
    zip.extractAllTo(targetDir, true);
    return targetDir;
}

/**
 * Get the absolute path to the location that Google Services
 * file should be placed, depending on the platform.
 * @param {object} context Cordova context
 * @returns {string} Absolute path to the location google
 * services file must be placed
 */
function getGoogleServiceTargetDir(context) {
    var platformPath = utils.getPlatformPath(context);
    var platform = context.opts.plugin.platform;
    switch (platform) {
        case "android": {
            var platformVersion = utils.getPlatformVersion(context);
            var majorPlatformVersion = platformVersion.split(".")[0];
            if (parseInt(majorPlatformVersion) >= 7) {
                return path.join(platformPath, "app");
            } else {
                return platformPath;
            }
        }
        case "ios":
            return platformPath;
        default:
            return undefined;
    }
}

/**
 * Attempts to copy google service files (json/plist) from the source directory
 * (the unziped folder under www) to the required target directory, depending on the platform
 * @param {string} sourceDir source directory containing google services files (json/plist)
 * @param {string} targetDir target directory where google service file will be placed
 * @param {string} platform the platform (android or ios) on which the plugin is being installed
 * @returns {boolean} Whether copy finished with success
 */
function copyGoogleServiceFile(sourceDir, targetDir, platform) {
    switch (platform) {
        case "android":
            return copyGoogleServiceOnAndroid(sourceDir, targetDir);
        case "ios":
            return copyGoogleServiceOnIos(sourceDir, targetDir);
        default:
            return false;
    }
}

function copyGoogleServiceOnAndroid(sourceDir, targetDir) {
    try {
        var sourceFilePath = path.join(sourceDir, "google-services.json");
        var targetFilePath = path.join(targetDir, "google-services.json");
        fs.copyFileSync(sourceFilePath, targetFilePath);
        return true;
    } catch (error) {
        return false;
    }
}

function copyGoogleServiceOnIos(sourceDir, targetDir) {
    try {
        var sourceFilePath = path.join(sourceDir, "GoogleService-Info.plist");
        var targetFilePath = path.join(targetDir, "GoogleService-Info.plist");
        fs.copyFileSync(sourceFilePath, targetFilePath);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = function (context) {
    return new Promise(function (resolve, reject) {
        var wwwpath = utils.getWwwPath(context);
        var appId = "";

        console.log("[PUSHWOOSH HELPER] Start GetzipFile");
        var configFile = "config.xml";
        var xmlData = fs.readFileSync(configFile).toString('utf8');

        var n = xmlData.search(" id=\"");
        if (n > 0) {
            n += 5;
            var count = 0;
            var cont = true;
            while (cont) {
                if (xmlData[n + count] == "\"") {
                    cont = false;
                } else {
                    count++;
                }
            }
            appId = xmlData.substring(n, n + count);
            console.log("[PUSHWOOSH HELPER] App Identifier detected: " + appId);
        }

        var configPath = path.join(wwwpath, "google-services", appId);

        // Check if files exist and delete them if found
        var existingFiles = ["google-services.json", "GoogleService-Info.plist"];
        existingFiles.forEach(function (file) {
            var filePath = path.join(configPath, file);
            console.log("[PUSHWOOSH HELPER] File path:", filePath);
            console.log("[PUSHWOOSH HELPER] File exists?:", fs.existsSync(filePath))
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log("[PUSHWOOSH HELPER] Deleted existing file:", filePath);
            }
        });

        var prefZipFilename = "google-services";
        var zipFile = getZipFile(configPath, prefZipFilename);

        // if zip file is present, lets unzip it!
        if (!zipFile) {
            return reject(
                "Failed to install Pushwoosh plugin. Reason: Configuration zip file not found."
            );
        }
        var unzipedResourcesDir = unzip(zipFile, configPath, prefZipFilename);
        var platform = context.opts.plugin.platform;
        var targetDir = getGoogleServiceTargetDir(context);
        console.log("[RICARDO HELPER]:", targetDir);
        var copyWithSuccess = copyGoogleServiceFile(
            unzipedResourcesDir,
            targetDir,
            platform
        );

        if (!copyWithSuccess) {
            return reject(
                "Failed to install pushwoosh plugin. Reason: Unable to copy google services file to project."
            );
        }
        return resolve();
    });
};