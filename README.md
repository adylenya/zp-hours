# Zimalab Project Hours Chrome Extension v1.2.2

This document provides a guide on how to install the Zimalab Project Hours Chrome Extension. This extension allows you to quickly log hours against your projects and tasks directly from your Chrome browser.

## Features

* **Secure Login:** Authenticate using your Zimalab credentials.

* **Project Selection:** Easily select from your assigned projects.

* **Task Management:** Search for existing tasks or create new ones immediately.

* **Effort Logging:** Log time spent in hours and minutes.

* **Comment Support:** Add comments to your logged hours for detailed reporting.

* **Session Management:** Your login session is stored securely, reducing the need to log in frequently.

## Installation Guide

To install this Chrome Extension, you will need to load it as an "unpacked" extension.

1.  **Download the Extension Files:** Obtain the extension files by cloning this repo or by clicking `Code` > `Download ZIP`. If you downloaded ZIP, unzip this file to a local directory on your computer. Make note of this directory path.

2.  **Open Chrome Extensions Page:**

    * Open your Google Chrome browser.

    * Type `chrome://extensions` into the address bar and press Enter. Alternatively, click the puzzle icon menu in the top-right corner, then navigate to `Manage Extensions`.

3.  **Enable Developer Mode:**

    * On the Extensions page, locate the "Developer mode" toggle switch in the top-right corner.

    * Click the toggle to turn it `On`. This will reveal new options for loading extensions.

4.  **Load Unpacked Extension:**

    * After enabling Developer mode, click the "Load unpacked" button that appears on the top-left side of the page.

    * A file dialog will open. Navigate to the directory where you unzipped the extension files (from Step 1).

    * Select the `src` folder inside the project folder and click "Select Folder".

5.  **Verify Installation:**

    * The extension should now appear in your list of installed extensions.

    * You will see a new icon in the extension list, I recommend to pin the extension for faster access. Click on this icon to open the extension's popup.

## Usage Instructions

### The usage is pretty straightforward, I will write instructions in the next version if needed.

## Important Notes

* **API Base URL:** Right now it points to demo ZP, when promoting to production its crucial to change the API Base URL to production website!

## Future Features

1. **Display Daily project reports**
    * Add display daily project reports to track already submitted hours
2. **Display All Today's Hours**
    * <s> Add display of the total today's hours.</s> Released in v1.1
3. **User's Full Name**
    * <s> Add User's Full Name instead of Email.</s> Released in v1.1