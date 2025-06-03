# OMNI

A Secure Desktop AI Assistant & MCP Client for industrial enterprises

## Auto-Updater

OMNI includes a robust auto-updater system that automatically checks for and installs updates.

### Features

- **Automatic Update Checking**: Checks for updates every 4 hours
- **Manual Update Checking**: Users can manually check for updates in Settings > Version
- **Error Recovery**: Automatic retry mechanism for transient network errors
- **Progress Tracking**: Real-time download progress with speed and ETA
- **Safe Installation**: Updates are verified before installation
- **Rollback Protection**: Failed updates don't break existing installations

### Troubleshooting

If you experience update issues:

1. **Check your internet connection** - Updates require a stable internet connection
2. **Restart the application** - Close and reopen OMNI to clear any temporary issues
3. **Manual download** - If auto-update fails, download the latest version from [releases](https://github.com/sub-arjun/OMNI-OS/releases)
4. **Clear update cache** - Delete `%APPDATA%/OMNI/pending-updates` folder (Windows) or `~/Library/Application Support/OMNI/pending-updates` (macOS)

### For Developers

The auto-updater is configured to:
- Use GitHub releases as the update source
- Download updates in the background
- Install updates on app restart
- Provide comprehensive error handling and logging

All update events are logged to the application logs for debugging purposes.

https://becomeomni.ai

 "This product is based on 5ire Community Edition and is not affiliated with 5ire."
