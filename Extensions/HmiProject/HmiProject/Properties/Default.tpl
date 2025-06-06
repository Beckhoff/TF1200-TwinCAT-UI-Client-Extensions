-- Designer --
<!DOCTYPE html>
<html lang="en" class="tchmi-html-designer">
<head>
  <meta charset="utf-8">
  <title>{{TITLE}}</title>
  <!-- target-densitydpi=device-dpi -->
  <meta name="viewport" content="{{METAVIEWPORT}}">
  <script>
    TCHMI_ENGINEERING = true;
    TCHMI_DESIGNER = true;
    TCHMI_CONFIG_OVERRIDE = {
      "basePath": "{{BASEURL}}",
      "tcHmiServer": {
        "websocketOverwrite": {
          "host": "{{SERVER_HOST}}",
          "port": {{SERVER_PORT}}
        },
        "websocketIntervalTime": 200
      }
    };

    window.onload = function load() {
      if ((!('TcHmi' in window) || !window.TcHmi.System) && document.body) {
        document.body.style.background = '#C8C8C8';
        document.body.innerHTML = 'TwinCAT HMI Framework could not be loaded.';
      }
      window.onload = null;
    };
  </script>
  {{GLOBAL_JS_INCLUDES}}
</head>
<body class="tchmi-body-designer">
  {{VIEWLEVEL}}
</body>
</html>
-- /Designer --

-- LiveView_and_Build --
<!DOCTYPE html>
<!--
  Copyright (C) {{YEAR}} {{COMPANYNAME}}
  For any information visit: {{COMPANYWEBSITE}}

  Deployment
  +++++++++++++++++++++++++++
  Version: {{VERSION}}
  Date: {{DATE}}, Time: {{TIME}}
-->
<html lang="en" class="tchmi-html-runtime">
<head>
  <meta charset="utf-8">
  <title>{{TITLE}}</title>
  <!-- target-densitydpi=device-dpi -->
  <meta name="robots" content="noindex, nofollow, noarchive, noimageindex">
  <meta name="google" content="notranslate">
  <meta name="viewport" content="{{METAVIEWPORT}}">
  <link rel="manifest" crossorigin="use-credentials" href="Properties/tchmimanifest.json">
  <link rel="icon" href="Images/Favicon.ico">
  {{GLOBAL_JS_INCLUDES}}
  <script>
   window.onload = function load() {
    if ((!('TcHmi' in window) || !window.TcHmi.System) && document.body) {
      document.body.style.background = '#C8C8C8';
      document.body.innerHTML = 'TwinCAT HMI Framework could not be loaded.';
      if(!("Promise" in window)){
        document.body.innerHTML += ' A more modern web browser (which supports ES6 JavaScript) is needed.';
      }
    }
    window.onload = null;
      };
  </script>
</head>
<body class="tchmi-body-runtime">
  <noscript style="font-size: large; padding: 50px;">
    TwinCAT HMI needs to execute JavaScript Code in the browser.
    Please enable JavaScript in this browser to use the HMI.
  </noscript>
  {{VIEWLEVEL}}
</body>
</html>
-- /LiveView_and_Build --