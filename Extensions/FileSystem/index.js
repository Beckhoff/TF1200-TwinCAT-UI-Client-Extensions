const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");
const fs = require("fs");
const path = require("path");

/**
 * Class representing the file system extension
 */
class FileSystem extends TcUiClientExt {

    /**
     * Get the absolute path of the given file path.
     * @param {string} filePath - The file path to resolve
     * @return {string} The absolute path of the file
     * @private
     */
    #getAbsolutePath(filePath) {
        return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    }

    /**
     * Converts a dirent to an object that can be transferred to the renderer context
     * @param {fs.Dirent} dirent
     */
    #direntToObject(dirent) {
        const ret = { name: dirent.name, parentPath: dirent.path };

        if (dirent.isFile()) {
            ret.type = "file";
        } else if (dirent.isDirectory()) {
            ret.type = "directory";
        } else if (dirent.isSymbolicLink()) {
            ret.type = "symlink";
        } else if (dirent.isBlockDevice()) {
            ret.type = "blockDevice";
        } else if (dirent.isCharacterDevice()) {
            ret.type = "characterDevice";
        } else if (dirent.isFIFO()) {
            ret.type = "fifo";
        } else if (dirent.isSocket()) {
            ret.type = "socket";
        }

        return ret;
    }

    /**
     * Read the content of a file.
     * @param {Object} args - The write value object containing the file path and encoding
     * @return {Object} The content of the file or an error object
     * @private
     */
    #readFile(args) {
        if (!args.path) {
            return { error: { message: "Missing parameter \"path\"" } };
        }

        try {
            const absoluteFilePath = this.#getAbsolutePath(args.path);
            return fs.readFileSync(absoluteFilePath, { encoding: args.encoding });
        } catch (err) {
            return { error: { message: "Error reading file", details: err.message } };
        }
    }

    /**
     * Write data to a file.
     * @param {Object} args - The write value object containing the file path, data, flag, and encoding
     * @return {Object} A success indicator or an error object
     * @private
     */
    #writeFile(args) {
        if (!args.path) {
            return { error: { message: "Missing parameter \"path\"" } };
        }

        // Allow an empty string to be written to the file, e.g. to create it
        if (!args.data && args.data !== "") {
            return { error: { message: "Missing parameter \"data\"" } };
        }

        try {
            const absoluteFilePath = this.#getAbsolutePath(args.path);

            // Writing to this directory is not allowed
            if (path.dirname(absoluteFilePath).startsWith(path.resolve(process.cwd()))) {
                return { error: { message: "Writing in the \"FileSystem\" extension directory is not allowed." } };
            }

            const options = {};

            if (args.flag) {
                options.flag = args.flag;
            }

            if (args.encoding) {
                options.encoding = args.encoding;
            }

            fs.writeFileSync(absoluteFilePath, args.data, options);
            return { success: true };
        } catch (err) {
            return { error: { message: "Error writing to file", details: err.message } };
        }
    }

    /**
     * Create a directory.
     * @param {Object} args - The write value object containing the directory path and recursive flag
     * @return {Object} The result of the operation or an error object
     * @private
     */
    #mkdir(args) {
        if (!args.path) {
            return { error: { message: "Missing parameter \"path\"" } };
        }

        try {
            const absoluteDirPath = this.#getAbsolutePath(args.path);
            const result = fs.mkdirSync(absoluteDirPath, { recursive: args.recursive });
            return result ?? { success: true };
        } catch (err) {
            return { error: { message: "Could not create directory", details: err.message } };
        }
    }

    /**
     * Read the contents of a directory.
     * @param {Object} args - The write value object containing the directory path and options
     * @return {Array|string[]|Object} A list of directory contents or an error object
     * @private
     */
    #readdir(args) {
        if (!args.path) {
            return { error: { message: "Missing parameter \"path\"" } };
        }

        const absoluteDirPath = this.#getAbsolutePath(args.path);

        // Deleting from this directory is not allowed
        if (path.dirname(absoluteDirPath).startsWith(path.resolve(process.cwd()))) {
            return { error: { message: "Deleting in the \"FileSystem\" extension directory is not allowed." } };
        }

        try {
            const options = {};
            if (args.encoding) {
                options.encoding = args.encoding;
            }

            if (args.withFileTypes) {
                options.withFileTypes = args.withFileTypes;
            }

            if (args.recursive) {
                options.recursive = args.recursive;
            }

            const ret = fs.readdirSync(absoluteDirPath, options);

            if (ret[0] instanceof fs.Dirent) {
                return ret.map(this.#direntToObject);
            }

            return ret;
        } catch (err) {
            return { error: { message: `Error reading directory ${absoluteDirPath}`, details: err.message } };
        }
    }

    /**
     * Check if a path exists.
     * @param {Object} args - The write value object containing the path to check
     * @return {boolean} True if the path exists, false otherwise
     * @private
     */
    #exists(args) {
        if (!args.path) {
            return { error: { message: "Missing parameter \"path\"" } };
        }

        const absolutePath = this.#getAbsolutePath(args.path);
        return fs.existsSync(absolutePath);
    }

    /**
     * Rename a file or directory.
     * @param {Object} args - The write value object containing the old and new path
     * @return {Object} A success indicator or an error object
     * @private
     */
    #rename(args) {
        if (!args.oldPath) {
            return { error: { message: "Missing parameter \"oldPath\"" } };
        }

        if (!args.newPath) {
            return { error: { message: "Missing parameter \"newPath\"" } };
        }

        const absoluteOldPath = this.#getAbsolutePath(args.oldPath);
        const absoluteNewPath = this.#getAbsolutePath(args.newPath);

        try {
            fs.renameSync(absoluteOldPath, absoluteNewPath);
            return { success: true };
        } catch (err) {
            return { error: { message: `Could not rename ${args.oldPath} to ${args.newPath}`, details: err.message } };
        }
    }

    /**
     * Remove a file or directory.
     * @param {Object} args - The write value object containing the path to remove and the recursive flag
     * @return {Object} A success indicator or an error object
     * @private
     */
    #rm(args) {
        if (!args.path) {
            return { error: { message: "Missing parameter \"path\"" } };
        }

        const absolutePath = this.#getAbsolutePath(args.path);

        try {
            fs.rmSync(absolutePath, { recursive: args.recursive ?? false });
            return { success: true };
        } catch (err) {
            return { error: { message: `Could not delete ${absolutePath}`, details: err.message } };
        }
    }

    onMessage(command, args) {
        switch (command) {
            case "readFile":
                return this.#readFile(args);
            case "writeFile":
                return this.#writeFile(args);
            case "mkdir":
                return this.#mkdir(args);
            case "readdir":
                return this.#readdir(args);
            case "exists":
                return this.#exists(args);
            case "rename":
                return this.#rename(args);
            case "rm":
                return this.#rm(args);
            default:
                return { error: `Command '${command}' is not supported` };
        }
    }
}

module.exports = FileSystem;
