var fso = new ActiveXObject("Scripting.FileSystemObject");
var htmlPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "..\\freight_erp_full.html");
var file = fso.OpenTextFile(htmlPath, 1);
var content = file.ReadAll();
file.Close();

// Find script block
var startTag = "<script>";
var endTag = "</script>";
var startIdx = content.indexOf(startTag);
if (startIdx === -1) {
    // Try case-insensitive or with attributes
    var startPos = content.search(/<script[^>]*>/i);
    if (startPos !== -1) {
        var match = content.match(/<script[^>]*>/i);
        startIdx = startPos + match[0].length;
    }
} else {
    startIdx += startTag.length;
}

var endIdx = content.indexOf(endTag, startIdx);
if (startIdx === -1 || endIdx === -1) {
    WScript.Echo("Could not find script block!");
    WScript.Quit(1);
}

var jsCode = content.substring(startIdx, endIdx);

// We will use Function to check syntax
try {
    new Function(jsCode);
    WScript.Echo("SUCCESS: JS syntax is valid!");
} catch (e) {
    WScript.Echo("SYNTAX ERROR: " + e.description + " (number: " + (e.number & 0xFFFF) + ")");
    
    // Attempt to isolate the line by running parts of the code
    // Let's do a simple check: where does JScript fail to compile?
    // JScript does not support ES6 features like template strings natively in CSCRIPT,
    // so new Function(jsCode) itself will throw "Expected ';'" on ES6 template literals or arrow functions.
    // That's because Windows JScript is equivalent to ES3/ES5.
    // So cscript's JS engine might fail on ES6 code even if the code is valid in modern browsers.
}
WScript.Quit(0);
